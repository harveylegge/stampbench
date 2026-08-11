/**
 * Map a Medusa order onto the EN 16931 semantic invoice model.
 *
 * Pure and side-effect free: order data in, `Invoice` out. Everything the
 * standard computes (BT-106…BT-115, the BG-23 VAT breakdown) is derived by
 * `withComputedTotals`, so the BR-CO arithmetic chain passes by construction.
 *
 * Amount semantics: Medusa item/shipping `total` is after discounts and
 * includes tax; `tax_total` is the tax portion. Line net (BT-131) is
 * therefore `total - tax_total`, which keeps promotions folded into the
 * line instead of inventing document-level allowances Medusa never had.
 */
import {
  round2,
  withComputedTotals,
  withProfileDefaults,
  type AllowanceCharge,
  type Invoice,
  type InvoiceLine,
  type Party,
  type PostalAddress,
} from "@stampbench/core"

import type {
  EInvoiceOrder,
  EInvoiceOverrides,
  NumericValue,
  OrderAddress,
  OrderTaxLine,
  StampbenchOptions,
} from "./types"

/** Coerce Medusa's number | string | BigNumber-ish amounts to a number. */
export function toNumber(value: NumericValue): number {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof value === "object") {
    if (typeof value.numeric === "number") return value.numeric
    if (value.value != null) {
      const n = Number(value.value)
      return Number.isFinite(n) ? n : 0
    }
  }
  return 0
}

function taxRate(taxLines: OrderTaxLine[] | null | undefined): number {
  if (!taxLines?.length) return 0
  return round2(taxLines.reduce((sum, line) => sum + toNumber(line.rate), 0))
}

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key]
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

function mapAddress(address: OrderAddress): PostalAddress {
  return {
    streetName: address.address_1 ?? undefined,
    additionalStreet: address.address_2 ?? undefined,
    city: address.city ?? undefined,
    postCode: address.postal_code ?? undefined,
    countrySubdivision: address.province ?? undefined,
    countryCode: address.country_code?.toUpperCase() ?? undefined,
  }
}

function personName(
  source: { first_name?: string | null; last_name?: string | null } | null | undefined,
): string | undefined {
  const name = [source?.first_name, source?.last_name].filter(Boolean).join(" ").trim()
  return name || undefined
}

function buyerParty(order: EInvoiceOrder): Party {
  const billing = order.billing_address ?? undefined
  const name =
    billing?.company ??
    order.customer?.company_name ??
    personName(billing) ??
    personName(order.customer) ??
    order.email ??
    undefined
  const vatId =
    metadataString(order.metadata, "vat_id") ??
    metadataString(order.customer?.metadata, "vat_id")

  const party: Party = { name }
  if (vatId) party.vatId = vatId
  if (order.email) {
    party.electronicAddress = order.email
    party.electronicAddressScheme = "EM"
  }
  if (billing) {
    party.address = mapAddress(billing)
    const contactName = personName(billing) ?? name
    if (contactName || billing.phone || order.email) {
      party.contact = {
        name: contactName,
        phone: billing.phone ?? undefined,
        email: order.email ?? undefined,
      }
    }
  }
  return party
}

function vatFor(
  rate: number,
  options: StampbenchOptions,
): { categoryCode: string; rate: number } {
  if (rate > 0) return { categoryCode: "S", rate }
  return { categoryCode: options.zeroVatCategoryCode ?? "Z", rate: 0 }
}

function orderLines(order: EInvoiceOrder, options: StampbenchOptions): InvoiceLine[] {
  const unitCode = options.defaultUnitCode ?? "C62"
  return (order.items ?? []).map((item, index) => {
    const quantity = toNumber(item.quantity) || 1
    const net = round2(toNumber(item.total) - toNumber(item.tax_total))
    const line: InvoiceLine = {
      id: String(index + 1),
      quantity,
      unitCode,
      netAmount: net,
      item: {
        name: item.title ?? item.product_title ?? `Item ${index + 1}`,
        description: item.subtitle ?? undefined,
        sellerItemId: item.variant_sku ?? undefined,
      },
      price: { netPrice: round2(net / quantity) },
      vat: vatFor(taxRate(item.tax_lines), options),
    }
    return line
  })
}

function shippingCharges(
  order: EInvoiceOrder,
  options: StampbenchOptions,
): AllowanceCharge[] {
  const charges: AllowanceCharge[] = []
  for (const method of order.shipping_methods ?? []) {
    const net = round2(toNumber(method.total) - toNumber(method.tax_total))
    if (net === 0) continue
    const vat = vatFor(taxRate(method.tax_lines), options)
    charges.push({
      isCharge: true,
      amount: net,
      reason: method.name ?? "Shipping",
      vatCategoryCode: vat.categoryCode,
      vatRate: vat.rate,
    })
  }
  return charges
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}

/**
 * Build the full semantic invoice for an order: mapped parties, lines and
 * charges, profile defaults (BT-24/BT-23/BT-3/BT-5) and computed totals.
 */
export function orderToInvoice(
  order: EInvoiceOrder,
  options: StampbenchOptions = {},
  overrides: EInvoiceOverrides = {},
): Invoice {
  const issueDate = overrides.issueDate ?? isoDate(new Date())
  const dueDate =
    overrides.dueDate ?? addDays(issueDate, options.paymentTermsDays ?? 14)
  const orderNumber =
    toNumber(order.display_id) > 0 ? String(toNumber(order.display_id)) : order.id ?? ""
  const buyerReference =
    overrides.buyerReference ??
    metadataString(order.metadata, "buyer_reference") ??
    metadataString(order.metadata, "leitweg_id") ??
    options.defaultBuyerReference ??
    orderNumber
  const notes = [...(options.notes ?? []), ...(overrides.notes ?? [])]

  const invoice: Invoice = {
    number: overrides.invoiceNumber ?? `${options.invoiceNumberPrefix ?? "INV-"}${orderNumber}`,
    issueDate,
    dueDate,
    typeCode: overrides.typeCode,
    currencyCode: order.currency_code?.toUpperCase(),
    buyerReference,
    purchaseOrderReference: orderNumber || undefined,
    paymentTerms: options.paymentTerms,
    notes: notes.length ? notes : undefined,
    seller: options.seller,
    buyer: buyerParty(order),
    payment: options.payment,
    allowancesCharges: shippingCharges(order, options),
    lines: orderLines(order, options),
  }

  if (order.shipping_address) {
    invoice.delivery = {
      name:
        order.shipping_address.company ??
        personName(order.shipping_address) ??
        undefined,
      address: mapAddress(order.shipping_address),
    }
  }

  const exemptionReason = options.vatExemptionReason
  const computed = withComputedTotals(
    withProfileDefaults(invoice, { profile: options.profile ?? "xrechnung" }),
  )
  if (exemptionReason && computed.vatBreakdown) {
    computed.vatBreakdown = computed.vatBreakdown.map((group) =>
      group.categoryCode !== "S" && !group.exemptionReason
        ? { ...group, exemptionReason }
        : group,
    )
  }
  return computed
}

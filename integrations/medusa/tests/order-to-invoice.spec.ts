import { describe, expect, it } from "vitest"
import { generateUblInvoice, validateXml, type Party, type PaymentInstructions } from "@stampbench/core"

import { orderToInvoice, toNumber } from "../src/modules/stampbench/order-to-invoice"
import type { EInvoiceOrder, StampbenchOptions } from "../src/modules/stampbench/types"

/** A seller that satisfies the XRechnung (BR-DE) seller requirements. */
const seller: Party = {
  name: "Bergmann Audio GmbH",
  vatId: "DE123456789",
  electronicAddress: "billing@bergmann-audio.de",
  electronicAddressScheme: "EM",
  address: {
    streetName: "Torstraße 12",
    city: "Berlin",
    postCode: "10119",
    countryCode: "DE",
  },
  contact: {
    name: "Jonas Bergmann",
    phone: "+49 30 1234567",
    email: "billing@bergmann-audio.de",
  },
}

const payment: PaymentInstructions = {
  meansTypeCode: "58",
  remittanceInformation: "INV-1042",
  creditTransfers: [{ iban: "DE89370400440532013000", accountName: "Bergmann Audio GmbH" }],
}

const options: StampbenchOptions = { seller, payment }

/** German B2B order: two 19% lines (one discounted), taxed shipping. */
const order: EInvoiceOrder = {
  id: "order_01HXYZ",
  display_id: 1042,
  currency_code: "eur",
  email: "einkauf@musterfirma.de",
  metadata: { vat_id: "DE987654321" },
  customer: { company_name: "Musterfirma GmbH" },
  billing_address: {
    first_name: "Erika",
    last_name: "Mustermann",
    company: "Musterfirma GmbH",
    address_1: "Hauptstraße 5",
    city: "München",
    postal_code: "80331",
    country_code: "de",
    phone: "+49 89 7654321",
  },
  shipping_address: {
    company: "Musterfirma GmbH — Lager",
    address_1: "Industrieweg 9",
    city: "München",
    postal_code: "80339",
    country_code: "de",
  },
  items: [
    {
      title: "Studio Monitor A7",
      variant_sku: "SM-A7",
      quantity: 2,
      total: 47.6, // 40.00 net + 19% VAT
      tax_total: 7.6,
      tax_lines: [{ rate: 19 }],
    },
    {
      title: "XLR Cable 3m",
      variant_sku: "XLR-3",
      quantity: 1,
      total: "59.50", // string amount: 50.00 net + 19% VAT
      tax_total: { value: 9.5 }, // BigNumber-ish amount
      tax_lines: [{ rate: 19 }],
    },
  ],
  shipping_methods: [
    { name: "DHL Paket", total: 5.95, tax_total: 0.95, tax_lines: [{ rate: 19 }] },
  ],
}

describe("toNumber", () => {
  it("coerces Medusa amount shapes", () => {
    expect(toNumber(12.5)).toBe(12.5)
    expect(toNumber("47.60")).toBe(47.6)
    expect(toNumber({ value: "9.50" })).toBe(9.5)
    expect(toNumber({ numeric: 3 })).toBe(3)
    expect(toNumber(null)).toBe(0)
    expect(toNumber("not-a-number")).toBe(0)
  })
})

describe("orderToInvoice", () => {
  const invoice = orderToInvoice(order, options, { issueDate: "2026-08-11" })

  it("maps document header from the order", () => {
    expect(invoice.number).toBe("INV-1042")
    expect(invoice.currencyCode).toBe("EUR")
    expect(invoice.issueDate).toBe("2026-08-11")
    expect(invoice.dueDate).toBe("2026-08-25") // default 14-day terms
    expect(invoice.buyerReference).toBe("1042") // falls back to order number
    expect(invoice.purchaseOrderReference).toBe("1042")
    expect(invoice.typeCode).toBe("380")
  })

  it("maps the buyer from billing address, customer and metadata", () => {
    expect(invoice.buyer?.name).toBe("Musterfirma GmbH")
    expect(invoice.buyer?.vatId).toBe("DE987654321")
    expect(invoice.buyer?.electronicAddress).toBe("einkauf@musterfirma.de")
    expect(invoice.buyer?.address?.countryCode).toBe("DE")
    expect(invoice.buyer?.address?.city).toBe("München")
  })

  it("maps the delivery address (BG-13)", () => {
    expect(invoice.delivery?.name).toBe("Musterfirma GmbH — Lager")
    expect(invoice.delivery?.address?.postCode).toBe("80339")
  })

  it("derives line nets from tax-inclusive totals", () => {
    expect(invoice.lines).toHaveLength(2)
    expect(invoice.lines?.[0]?.netAmount).toBe(40)
    expect(invoice.lines?.[0]?.vat).toEqual({ categoryCode: "S", rate: 19 })
    expect(invoice.lines?.[0]?.item?.sellerItemId).toBe("SM-A7")
    expect(invoice.lines?.[1]?.netAmount).toBe(50) // string/BigNumber amounts
  })

  it("maps shipping as a document-level charge with VAT", () => {
    expect(invoice.allowancesCharges).toEqual([
      { isCharge: true, amount: 5, reason: "DHL Paket", vatCategoryCode: "S", vatRate: 19 },
    ])
  })

  it("computes BR-CO-consistent totals and VAT breakdown", () => {
    expect(invoice.totals?.sumOfLineNet).toBe(90)
    expect(invoice.totals?.chargeTotal).toBe(5)
    expect(invoice.totals?.taxExclusive).toBe(95)
    expect(invoice.totals?.taxTotal).toBe(18.05)
    expect(invoice.totals?.taxInclusive).toBe(113.05)
    expect(invoice.totals?.amountDue).toBe(113.05)
    expect(invoice.vatBreakdown).toEqual([
      { categoryCode: "S", rate: 19, taxableAmount: 95, taxAmount: 18.05 },
    ])
  })

  it("generates XRechnung UBL that passes the rule engine", () => {
    const xml = generateUblInvoice(invoice, { profile: "xrechnung" })
    const result = validateXml(xml, { profile: "xrechnung" })
    const errors = result.violations.filter((v) => v.severity === "error")
    expect(errors).toEqual([])
    expect(xml).toContain("xrechnung_3.0")
  })

  it("flags incomplete configuration instead of hiding it", () => {
    const bare = orderToInvoice(order, {}, { issueDate: "2026-08-11" })
    const xml = generateUblInvoice(bare, { profile: "xrechnung" })
    const result = validateXml(xml, { profile: "xrechnung" })
    const ruleIds = result.violations.map((v) => v.ruleId)
    expect(ruleIds.length).toBeGreaterThan(0) // missing seller & payment details
  })

  it("uses the configured category for zero-rated lines", () => {
    const zeroOrder: EInvoiceOrder = {
      ...order,
      items: [{ title: "Export item", quantity: 1, total: 100, tax_total: 0, tax_lines: [] }],
      shipping_methods: [],
    }
    const zeroInvoice = orderToInvoice(
      zeroOrder,
      { ...options, zeroVatCategoryCode: "G", vatExemptionReason: "Export delivery, §6 UStG" },
      { issueDate: "2026-08-11" },
    )
    expect(zeroInvoice.lines?.[0]?.vat).toEqual({ categoryCode: "G", rate: 0 })
    expect(zeroInvoice.vatBreakdown?.[0]?.exemptionReason).toBe("Export delivery, §6 UStG")
  })

  it("honours per-invoice overrides", () => {
    const credit = orderToInvoice(order, options, {
      invoiceNumber: "CN-7",
      typeCode: "381",
      issueDate: "2026-08-11",
      dueDate: "2026-09-01",
      buyerReference: "04011000-1234512345-06",
      notes: ["Correction of INV-1042"],
    })
    expect(credit.number).toBe("CN-7")
    expect(credit.typeCode).toBe("381")
    expect(credit.dueDate).toBe("2026-09-01")
    expect(credit.buyerReference).toBe("04011000-1234512345-06")
    expect(credit.notes).toEqual(["Correction of INV-1042"])
  })
})

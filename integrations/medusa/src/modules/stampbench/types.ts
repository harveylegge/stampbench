import type {
  Invoice,
  Party,
  PaymentInstructions,
  Profile,
  ValidateXmlResult,
} from "@stampbench/core"

/**
 * Medusa serializes money amounts as numbers, numeric strings, or
 * BigNumber-ish objects depending on where the value came from
 * (query.graph, raw module output, JSON round-trips). Accept them all.
 */
export type NumericValue =
  | number
  | string
  | { value?: string | number; numeric?: number }
  | null
  | undefined

/**
 * Structural view of the Medusa order data this plugin consumes.
 *
 * Kept structural on purpose: any object with these fields works — a
 * `query.graph` result, a workflow input, or a plain fixture in tests —
 * and the mapper never needs `@medusajs/framework` at runtime.
 */
export interface OrderTaxLine {
  rate?: NumericValue
  code?: string | null
}

export interface OrderAddress {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  province?: string | null
  country_code?: string | null
  phone?: string | null
}

export interface OrderLineItem {
  id?: string
  title?: string | null
  subtitle?: string | null
  product_title?: string | null
  variant_sku?: string | null
  quantity?: NumericValue
  /** Line total after discounts, including tax. */
  total?: NumericValue
  /** Tax portion of `total`. */
  tax_total?: NumericValue
  tax_lines?: OrderTaxLine[] | null
}

export interface OrderShippingMethod {
  name?: string | null
  total?: NumericValue
  tax_total?: NumericValue
  tax_lines?: OrderTaxLine[] | null
}

export interface EInvoiceOrder {
  id?: string
  display_id?: NumericValue
  currency_code?: string | null
  email?: string | null
  metadata?: Record<string, unknown> | null
  customer?: {
    company_name?: string | null
    first_name?: string | null
    last_name?: string | null
    metadata?: Record<string, unknown> | null
  } | null
  billing_address?: OrderAddress | null
  shipping_address?: OrderAddress | null
  items?: OrderLineItem[] | null
  shipping_methods?: OrderShippingMethod[] | null
}

/**
 * Plugin options, passed through `medusa-config.ts`:
 *
 * ```ts
 * plugins: [
 *   {
 *     resolve: "@stampbench/medusa",
 *     options: { seller: { … }, payment: { … } },
 *   },
 * ]
 * ```
 */
export interface StampbenchOptions {
  /**
   * BG-4 — you, the seller. XRechnung (BR-DE) requires legal name, full
   * postal address, a VAT or tax registration id, an electronic address,
   * and a contact with name, phone and email. Without it every generated
   * invoice will (correctly) fail validation.
   */
  seller?: Party
  /**
   * BG-16 — how buyers pay you. XRechnung requires payment instructions
   * (BR-DE-1); for SEPA credit transfer use meansTypeCode "58" plus an
   * IBAN in `creditTransfers`.
   */
  payment?: PaymentInstructions
  /** Ruleset the documents declare and validate against. Default: "xrechnung". */
  profile?: Profile
  /** Prefix for derived invoice numbers (`<prefix><display_id>`). Default: "INV-". */
  invoiceNumberPrefix?: string
  /** UN/ECE Rec 20 unit code for order lines. Default: "C62" (unit/piece). */
  defaultUnitCode?: string
  /**
   * VAT category for lines taxed at 0% (UNCL 5305). Default: "Z"
   * (zero-rated). Use "E" (exempt), "G" (export), "AE" (reverse charge)
   * or "O" (out of scope) per your tax setup — those categories also
   * need `vatExemptionReason`.
   */
  zeroVatCategoryCode?: string
  /** BT-120 — exemption reason text for E/AE/K/G/O breakdowns. */
  vatExemptionReason?: string
  /**
   * BT-10 fallback when the order carries no buyer reference. XRechnung
   * requires BT-10 (BR-DE-15); when neither metadata nor this option
   * provides one, the order number is used.
   */
  defaultBuyerReference?: string
  /** BT-20 — payment terms text (Skonto lines for XRechnung go here). */
  paymentTerms?: string
  /** Days until due; sets BT-9 relative to the issue date. Default: 14. */
  paymentTermsDays?: number
  /** BT-22 — notes stamped on every invoice (e.g. "Kleinunternehmer §19 UStG"). */
  notes?: string[]
}

/** Per-invoice overrides for a single `generate()` call. */
export interface EInvoiceOverrides {
  /** BT-1 — invoice number. Default: `<prefix><display_id>`. */
  invoiceNumber?: string
  /** BT-2 — issue date (YYYY-MM-DD). Default: today. */
  issueDate?: string
  /** BT-9 — due date (YYYY-MM-DD). Default: issue date + paymentTermsDays. */
  dueDate?: string
  /** BT-10 — buyer reference (Leitweg-ID for German B2G). */
  buyerReference?: string
  /** BT-3 — invoice type code. Default "380"; "381" for credit notes. */
  typeCode?: string
  /** BT-22 — extra notes for this invoice, appended after option-level notes. */
  notes?: string[]
}

export interface EInvoiceResult {
  /** The generated UBL 2.1 invoice document. */
  xml: string
  /** The semantic (EN 16931) model the XML was generated from. */
  invoice: Invoice
  /** Rule-engine verdict for the generated document. */
  validation: ValidateXmlResult
}

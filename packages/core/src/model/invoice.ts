/**
 * The EN 16931 semantic invoice model, expressed as plain TypeScript.
 *
 * Field names carry their EN 16931 Business Term (BT) / Business Group (BG)
 * identifiers in comments so violations can point at the exact term the
 * standard talks about. Monetary values are plain numbers rounded to 2dp;
 * if your system uses integer cents, divide by 100 at the boundary.
 */

/** BG-5 / BG-8 — a postal address. */
export interface PostalAddress {
  /** BT-35 / BT-50 — street name and number. */
  streetName?: string;
  /** BT-36 / BT-51 — additional address line. */
  additionalStreet?: string;
  /** BT-37 / BT-52 — city. */
  city?: string;
  /** BT-38 / BT-53 — post code. */
  postCode?: string;
  /** BT-39 / BT-54 — country subdivision (state/region). */
  countrySubdivision?: string;
  /** BT-40 / BT-55 — ISO 3166-1 alpha-2 country code. */
  countryCode?: string;
}

/** BG-6 — a contact point for a party. */
export interface Contact {
  /** BT-41 / BT-56 — contact point name. */
  name?: string;
  /** BT-42 / BT-57 — telephone. */
  phone?: string;
  /** BT-43 / BT-58 — email. */
  email?: string;
}

/** BG-4 (seller) / BG-7 (buyer). */
export interface Party {
  /** BT-27 / BT-44 — legal name. */
  name?: string;
  /** BT-28 / BT-45 — trading name, if different. */
  tradingName?: string;
  /** BT-29 / BT-46 — party identifier (e.g. GLN, supplier number). */
  identifier?: string;
  /** BT-30 / BT-47 — legal registration identifier (e.g. HRB number). */
  legalRegistrationId?: string;
  /** BT-31 / BT-48 — VAT identifier (e.g. DE123456789). */
  vatId?: string;
  /** BT-32 — seller tax registration (e.g. German Steuernummer). */
  taxRegistrationId?: string;
  /** BT-34 / BT-49 — electronic address (e.g. Peppol participant ID, email). */
  electronicAddress?: string;
  /** Scheme of the electronic address (e.g. "EM" for email, "0204" Leitweg). */
  electronicAddressScheme?: string;
  /** BG-5 / BG-8 — postal address. */
  address?: PostalAddress;
  /** BG-6 / BG-9 — contact point. */
  contact?: Contact;
}

/** BG-17 — credit transfer account details. */
export interface CreditTransfer {
  /** BT-84 — payment account identifier (IBAN). */
  iban?: string;
  /** BT-85 — payment account name. */
  accountName?: string;
  /** BT-86 — payment service provider identifier (BIC). */
  bic?: string;
}

/** BG-16 — payment instructions. */
export interface PaymentInstructions {
  /**
   * BT-81 — payment means type code (UNCL 4461).
   * Common values: 58 SEPA credit transfer, 30 credit transfer,
   * 59 SEPA direct debit, 48 bank card, 68 online payment service.
   */
  meansTypeCode?: string;
  /** BT-82 — payment means text. */
  meansText?: string;
  /** BT-83 — remittance information (payment reference). */
  remittanceInformation?: string;
  /** BG-17 — credit transfer accounts (repeatable). */
  creditTransfers?: CreditTransfer[];
  /** BT-91 — debited account identifier (direct debit). */
  debitedAccountIban?: string;
  /** BT-89 — SEPA mandate reference (direct debit). */
  mandateReference?: string;
}

/** BG-20 (allowance) / BG-21 (charge) at document level. */
export interface AllowanceCharge {
  /** True = charge (BG-21), false = allowance (BG-20). */
  isCharge: boolean;
  /** BT-92 / BT-99 — amount. */
  amount: number;
  /** BT-93 / BT-100 — base amount the percentage applies to. */
  baseAmount?: number;
  /** BT-94 / BT-101 — percentage. */
  percentage?: number;
  /** BT-97 / BT-104 — reason text. */
  reason?: string;
  /** BT-98 / BT-105 — reason code (UNCL 5189 / 7161). */
  reasonCode?: string;
  /** BT-95 / BT-102 — VAT category code of the allowance/charge. */
  vatCategoryCode?: string;
  /** BT-96 / BT-103 — VAT rate. */
  vatRate?: number;
}

/** BG-23 — one VAT breakdown per category/rate combination. */
export interface VatBreakdown {
  /** BT-118 — VAT category code (UNCL 5305: S, Z, E, AE, K, G, O, L, M). */
  categoryCode: string;
  /** BT-119 — VAT rate as a percentage (e.g. 19). */
  rate?: number;
  /** BT-116 — sum of all taxable amounts subject to this category/rate. */
  taxableAmount: number;
  /** BT-117 — VAT amount for this category/rate. */
  taxAmount: number;
  /** BT-120 — exemption reason text. */
  exemptionReason?: string;
  /** BT-121 — exemption reason code. */
  exemptionReasonCode?: string;
}

/** BG-30 — line-level VAT information. */
export interface LineVat {
  /** BT-151 — VAT category code. */
  categoryCode?: string;
  /** BT-152 — VAT rate. */
  rate?: number;
}

/** BG-31 — item information. */
export interface Item {
  /** BT-153 — item name. */
  name?: string;
  /** BT-154 — item description. */
  description?: string;
  /** BT-155 — seller's item identifier. */
  sellerItemId?: string;
  /** BT-157 — standard item identifier (e.g. GTIN). */
  standardItemId?: string;
}

/** BG-29 — price details. */
export interface Price {
  /** BT-146 — net price per unit (after price discounts). */
  netPrice?: number;
  /** BT-149 — base quantity the price applies to (default 1). */
  baseQuantity?: number;
  /** BT-150 — base quantity unit code. */
  baseQuantityUnit?: string;
}

/** BG-25 — an invoice line. */
export interface InvoiceLine {
  /** BT-126 — line identifier. */
  id?: string;
  /** BT-127 — line note. */
  note?: string;
  /** BT-129 — invoiced quantity. */
  quantity?: number;
  /** BT-130 — quantity unit code (UN/ECE Rec 20, e.g. "C62", "HUR", "DAY"). */
  unitCode?: string;
  /** BT-131 — line net amount (quantity × net price ± line allowances/charges). */
  netAmount?: number;
  /** BT-132 — referenced purchase order line. */
  orderLineReference?: string;
  /** BG-31 — item. */
  item?: Item;
  /** BG-29 — price. */
  price?: Price;
  /** BG-30 — line VAT. */
  vat?: LineVat;
}

/** BG-22 — document totals. */
export interface Totals {
  /** BT-106 — sum of all line net amounts. */
  sumOfLineNet?: number;
  /** BT-107 — sum of document-level allowances. */
  allowanceTotal?: number;
  /** BT-108 — sum of document-level charges. */
  chargeTotal?: number;
  /** BT-109 — total without VAT. */
  taxExclusive?: number;
  /** BT-110 — total VAT amount. */
  taxTotal?: number;
  /** BT-112 — total with VAT. */
  taxInclusive?: number;
  /** BT-113 — amount already paid. */
  paidAmount?: number;
  /** BT-114 — rounding amount. */
  roundingAmount?: number;
  /** BT-115 — amount due for payment. */
  amountDue?: number;
}

/**
 * BG-13 — delivery information: where the goods or services actually went,
 * and when.
 *
 * Distinct from the buyer (BG-7) on purpose: an invoice is billed to one
 * address and delivered to another often enough that EN 16931 gives delivery
 * its own group. Without it a "ship to" on an invoice has nowhere structured
 * to live and quietly becomes decoration on a PDF.
 */
export interface Delivery {
  /** BT-70 — the name of the party the goods are delivered to. */
  name?: string;
  /** BT-71 — delivery location identifier (e.g. a GLN). */
  locationId?: string;
  /** Scheme of the location identifier (e.g. "0088" for GLN). */
  locationIdScheme?: string;
  /** BT-72 — the date the supply actually took place. */
  actualDate?: string;
  /** BG-15 — the delivery address. */
  address?: PostalAddress;
}

/** BG-3 — reference to a preceding invoice (credit notes, corrections). */
export interface PrecedingInvoiceReference {
  /** BT-25 — preceding invoice number. */
  number: string;
  /** BT-26 — preceding invoice issue date. */
  issueDate?: string;
}

/** The EN 16931 semantic invoice. */
export interface Invoice {
  /**
   * BT-24 — specification identifier. For XRechnung 3.x:
   * "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"
   */
  specificationIdentifier?: string;
  /** BT-23 — business process type (e.g. Peppol "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"). */
  businessProcessType?: string;
  /** BT-1 — invoice number. */
  number?: string;
  /** BT-2 — issue date (ISO 8601, YYYY-MM-DD). */
  issueDate?: string;
  /** BT-3 — invoice type code (UNCL 1001). 380 = commercial invoice, 381 = credit note. */
  typeCode?: string;
  /** BT-5 — invoice currency code (ISO 4217). */
  currencyCode?: string;
  /** BT-6 — VAT accounting currency code, if different. */
  vatAccountingCurrencyCode?: string;
  /** BT-7 — value added tax point date. */
  taxPointDate?: string;
  /** BT-9 — payment due date (ISO 8601). */
  dueDate?: string;
  /** BT-10 — buyer reference (in Germany often the Leitweg-ID for B2G). */
  buyerReference?: string;
  /** BT-13 — purchase order reference. */
  purchaseOrderReference?: string;
  /** BT-12 — contract reference. */
  contractReference?: string;
  /** BT-11 — project reference. */
  projectReference?: string;
  /** BT-20 — payment terms text (in XRechnung also used for Skonto). */
  paymentTerms?: string;
  /** BT-22 — invoice notes. */
  notes?: string[];
  /** BG-14 — invoicing period. */
  invoicePeriod?: { startDate?: string; endDate?: string };
  /** BG-3 — preceding invoice references. */
  precedingInvoices?: PrecedingInvoiceReference[];
  /** BG-4 — seller. */
  seller?: Party;
  /** BG-7 — buyer. */
  buyer?: Party;
  /** BG-10 — payee, if different from seller. */
  payee?: Party;
  /** BG-16 — payment instructions. */
  /** BG-13 — where and when the supply was delivered. */
  delivery?: Delivery;
  payment?: PaymentInstructions;
  /** BG-20/BG-21 — document-level allowances and charges. */
  allowancesCharges?: AllowanceCharge[];
  /** BG-22 — totals. */
  totals?: Totals;
  /** BG-23 — VAT breakdown. */
  vatBreakdown?: VatBreakdown[];
  /** BG-25 — invoice lines. */
  lines?: InvoiceLine[];
}

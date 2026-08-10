/**
 * The builder's own state shape.
 *
 * Deliberately *not* the EN 16931 `Invoice` model. A form holds half-typed
 * text, a quantity that is currently the string "2." and a VAT rate the user
 * is mid-way through changing; the semantic model holds numbers that are
 * supposed to be true. Keeping them apart means the mapping in `build.ts` is
 * the single place where "what someone typed" becomes "what the document
 * claims", which is exactly where the money arithmetic and the never-invent
 * rule belong.
 *
 * Everything here is strings, because that is what inputs produce. Parsing
 * happens once, on the way out.
 */
import type { MarketId } from '@/lib/markets';
import { DEFAULT_FORMAT } from './formats';
import { getCountry } from './countries';
import type { VatCategoryCode } from './tax';

export interface DraftParty {
  name: string;
  tradingName: string;
  /** BT-31 / BT-48 — VAT identifier. */
  vatId: string;
  /** BT-32 — seller tax registration (German Steuernummer, US EIN, …). */
  taxRegistrationId: string;
  /** BT-30 / BT-47 — company register identifier. */
  companyId: string;
  /** BT-34 / BT-49 — electronic address (Peppol id, Leitweg-ID, email). */
  electronicAddress: string;
  electronicAddressScheme: string;
  street: string;
  additionalStreet: string;
  city: string;
  postCode: string;
  /** BT-39 / BT-54 — state, province, county. */
  subdivision: string;
  countryCode: string;
  contactName: string;
  phone: string;
  email: string;
}

export interface DraftLine {
  /** Stable React key. Never leaves the builder. */
  key: string;
  description: string;
  /** Free text — parsed as a decimal on the way out. */
  quantity: string;
  /** UN/ECE Rec 20 code (C62 = piece, HUR = hour, DAY, KGM, MTR…). */
  unitCode: string;
  unitPrice: string;
  /** BT-155 — seller's article number. */
  sku: string;
  vatCategory: VatCategoryCode;
  vatRate: string;
}

export interface DraftDocument {
  /** BT-1 — invoice number. */
  number: string;
  /** BT-2 — issue date, ISO. */
  issueDate: string;
  /** BT-9 — due date, ISO. */
  dueDate: string;
  /** BT-5 — currency code. */
  currency: string;
  /** BT-3 — 380 invoice, 381 credit note, 384 corrected. */
  typeCode: string;
  /** BT-10 — buyer reference (the Leitweg-ID for German public buyers). */
  buyerReference: string;
  /** BT-13 — purchase order reference. */
  orderReference: string;
  /** BT-12 — contract reference. */
  contractReference: string;
  /** BT-72 — actual delivery date. */
  deliveryDate: string;
  /** BT-20 — payment terms text. */
  paymentTerms: string;
  /** BT-22 — invoice note. */
  note: string;
}

export interface DraftPayment {
  /** BT-81 — UNCL 4461 payment means code. */
  meansTypeCode: string;
  /** BT-85 — account holder name. */
  accountName: string;
  /**
   * BT-84 — the payment account identifier. An IBAN in the SEPA area, a
   * domestic account number in the UK and US; EN 16931 does not require it to
   * be an IBAN, so all three are legitimate values for the same field.
   */
  accountId: string;
  /**
   * BT-86 — the payment service provider identifier: a BIC in the SEPA area,
   * a sort code in the UK, an ABA routing number in the US.
   */
  providerId: string;
  /** BT-83 — remittance information / payment reference. */
  remittance: string;
}

export interface InvoiceDraft {
  market: MarketId;
  formatId: string;
  seller: DraftParty;
  buyer: DraftParty;
  document: DraftDocument;
  lines: DraftLine[];
  payment: DraftPayment;
  /**
   * BT-120 per VAT category. Keyed by category code because the breakdown is
   * grouped by category, and the engine wants one reason per group.
   */
  exemptionReasons: Partial<Record<VatCategoryCode, string>>;
}

export const EMPTY_PARTY: DraftParty = {
  name: '',
  tradingName: '',
  vatId: '',
  taxRegistrationId: '',
  companyId: '',
  electronicAddress: '',
  electronicAddressScheme: '',
  street: '',
  additionalStreet: '',
  city: '',
  postCode: '',
  subdivision: '',
  countryCode: '',
  contactName: '',
  phone: '',
  email: '',
};

/** Unit codes offered in the line editor. UN/ECE Recommendation 20. */
export const UNIT_OPTIONS: { code: string; label: string }[] = [
  { code: 'C62', label: 'Item' },
  { code: 'HUR', label: 'Hour' },
  { code: 'DAY', label: 'Day' },
  { code: 'MON', label: 'Month' },
  { code: 'ANN', label: 'Year' },
  { code: 'KGM', label: 'Kilogram' },
  { code: 'MTR', label: 'Metre' },
  { code: 'MTK', label: 'Square metre' },
  { code: 'LTR', label: 'Litre' },
  { code: 'KMT', label: 'Kilometre' },
  { code: 'E48', label: 'Service unit' },
  { code: 'P1', label: 'Percent' },
];

/** BT-3 document types the engine accepts. */
export const TYPE_CODE_OPTIONS: { code: string; label: string }[] = [
  { code: '380', label: 'Commercial invoice' },
  { code: '381', label: 'Credit note' },
  { code: '384', label: 'Corrected invoice' },
  { code: '386', label: 'Prepayment invoice' },
  { code: '326', label: 'Partial invoice' },
  { code: '389', label: 'Self-billed invoice' },
];

/** BT-81 payment means, with the fields each one implies. */
export const PAYMENT_MEANS_OPTIONS: { code: string; label: string; needsAccount: boolean }[] = [
  { code: '58', label: 'SEPA credit transfer', needsAccount: true },
  { code: '30', label: 'Credit transfer', needsAccount: true },
  { code: '59', label: 'SEPA direct debit', needsAccount: false },
  { code: '49', label: 'Direct debit', needsAccount: false },
  { code: '48', label: 'Bank card', needsAccount: false },
  { code: '68', label: 'Online payment service', needsAccount: false },
  { code: '10', label: 'Cash', needsAccount: false },
  { code: '1', label: 'Other', needsAccount: false },
];

export function newLine(vatCategory: VatCategoryCode = 'S', vatRate = ''): DraftLine {
  return {
    // Not crypto.randomUUID(): this runs during render on first mount and
    // needs to be stable across a server/client boundary in a static export.
    key: `line-${Math.random().toString(36).slice(2, 10)}`,
    description: '',
    quantity: '1',
    unitCode: 'C62',
    unitPrice: '',
    sku: '',
    vatCategory,
    vatRate,
  };
}

function isoToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isoPlusDays(now: Date, days: number): string {
  const d = new Date(now.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * A sequential-looking invoice number. Deliberately derived from the date and
 * a counter the caller supplies rather than a random string: invoice numbers
 * are supposed to be sequential and auditable, and a user who keeps the
 * suggested number should end up with something that looks like a real
 * numbering series. They can always overwrite it.
 */
export function suggestInvoiceNumber(now: Date, sequence: number): string {
  return `INV-${now.getFullYear()}-${String(sequence).padStart(6, '0')}`;
}

export function emptyDraft(market: MarketId, now: Date, sequence = 1): InvoiceDraft {
  const country = getCountry(defaultCountryFor(market));
  return {
    market,
    formatId: DEFAULT_FORMAT[market] ?? 'en16931-ubl',
    seller: { ...EMPTY_PARTY, countryCode: country.code },
    buyer: { ...EMPTY_PARTY, countryCode: country.code },
    document: {
      number: suggestInvoiceNumber(now, sequence),
      issueDate: isoToday(now),
      dueDate: isoPlusDays(now, 30),
      currency: country.currency,
      typeCode: '380',
      buyerReference: '',
      orderReference: '',
      contractReference: '',
      deliveryDate: '',
      paymentTerms: 'Payment within 30 days of the invoice date.',
      note: '',
    },
    lines: [newLine('S', country.commonVatRates?.[0]?.toString() ?? '')],
    payment: {
      meansTypeCode: country.bank === 'iban' ? '58' : '30',
      accountName: '',
      accountId: '',
      providerId: '',
      remittance: '',
    },
    exemptionReasons: {},
  };
}

/** The country a market's forms should start on. */
export function defaultCountryFor(market: MarketId): string {
  switch (market) {
    case 'uk':
      return 'GB';
    case 'us':
      return 'US';
    case 'germany':
      return 'DE';
    case 'eu':
      return 'DE';
    default:
      return '';
  }
}

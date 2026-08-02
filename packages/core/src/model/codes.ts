/**
 * Code lists used by validation. Membership checks against the *common*
 * subsets below produce warnings, never errors — the full official lists are
 * large and versioned, so a code we don't recognise may still be valid.
 * Format checks (shape of the code) do produce errors.
 */

/** UNCL 5305 — VAT category codes. This list IS closed, so membership is an error. */
export const VAT_CATEGORY_CODES = new Set([
  'S', // standard rate
  'Z', // zero-rated
  'E', // exempt
  'AE', // reverse charge
  'K', // intra-community supply
  'G', // export outside the EU
  'O', // not subject to VAT
  'L', // Canary Islands IGIC
  'M', // Ceuta/Melilla IPSI
]);

/**
 * UNCL 1001 subset admitted by XRechnung (BR-DE-17).
 * 326 partial, 380 commercial, 381 credit note, 384 corrected,
 * 386 prepayment, 389 self-billed.
 */
export const XRECHNUNG_TYPE_CODES = new Set(['326', '380', '381', '384', '386', '389']);

/** Common ISO 4217 currency codes (subset — unknown codes warn, not error). */
export const COMMON_CURRENCY_CODES = new Set([
  'EUR', 'GBP', 'USD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
  'RON', 'BGN', 'HRK', 'ISK', 'JPY', 'CNY', 'AUD', 'CAD', 'NZD', 'SGD',
  'HKD', 'INR', 'BRL', 'MXN', 'ZAR', 'TRY', 'AED', 'SAR', 'KRW', 'THB',
]);

/** Common UN/ECE Rec 20 unit codes (subset — unknown codes warn, not error). */
export const COMMON_UNIT_CODES = new Set([
  'C62', // one (unit)
  'H87', // piece
  'EA', // each
  'HUR', // hour
  'DAY', // day
  'MON', // month
  'ANN', // year
  'KGM', // kilogram
  'GRM', // gram
  'TNE', // tonne
  'MTR', // metre
  'MTK', // square metre
  'MTQ', // cubic metre
  'LTR', // litre
  'MLT', // millilitre
  'KWH', // kilowatt hour
  'CMT', // centimetre
  'MMT', // millimetre
  'KMT', // kilometre
  'SET', // set
  'PR', // pair
  'PK', // pack
  'BX', // box
  'XPP', // unpacked
  'LS', // lump sum
  'P1', // percent
]);

/**
 * UNCL 4461 payment means codes commonly used in XRechnung.
 * 58 = SEPA credit transfer, 30 = credit transfer, 59 = SEPA direct debit,
 * 48 = bank card, 68 = online payment service, 57 = standing order,
 * 97 = clearing between partners, 10 = cash, 20 = cheque.
 */
export const COMMON_PAYMENT_MEANS_CODES = new Set([
  '10', '20', '30', '48', '54', '55', '57', '58', '59', '68', '97',
]);

/** Payment means codes that denote a credit transfer (require an account, BR-DE-23 area). */
export const CREDIT_TRANSFER_MEANS_CODES = new Set(['30', '58']);

/** Payment means codes that denote a direct debit (BR-DE-24 area). */
export const DIRECT_DEBIT_MEANS_CODES = new Set(['49', '59']);

/** The XRechnung 3.x specification identifier (BT-24). */
export const XRECHNUNG_30_SPEC_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';

/** Recognisable fragment that identifies any XRechnung CIUS spec id. */
export const XRECHNUNG_SPEC_FRAGMENT = 'xrechnung';

/** The plain EN 16931 compliance spec id. */
export const EN16931_SPEC_ID = 'urn:cen.eu:en16931:2017';

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const CURRENCY_CODE_RE = /^[A-Z]{3}$/;
export const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
/** Loose IBAN shape check: country code + 2 check digits + 11–30 alphanumerics. */
export const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/**
 * @invoicegate/core — validate and generate EN 16931 / XRechnung e-invoices
 * in pure TypeScript.
 *
 * ```ts
 * import { validateUblXml, generateXRechnungUbl, withComputedTotals } from '@invoicegate/core';
 *
 * const result = validateUblXml(xmlString);          // → violations with BR/BR-DE rule ids
 * const invoice = withComputedTotals({ lines, seller, buyer, … });
 * const xml = generateXRechnungUbl(invoice);         // → XRechnung 3.0 UBL
 * ```
 *
 * Scope: UBL syntax, EN 16931 core rules + XRechnung (BR-DE) CIUS — the
 * documented subset in docs/rules-coverage.md. This is developer tooling,
 * not legal advice; for certification-grade checks also run the official
 * KoSIT validator in CI.
 */
export type {
  AllowanceCharge,
  Contact,
  CreditTransfer,
  Invoice,
  InvoiceLine,
  Item,
  LineVat,
  Party,
  PaymentInstructions,
  PostalAddress,
  PrecedingInvoiceReference,
  Price,
  Totals,
  VatBreakdown,
} from './model/invoice.js';

export {
  COMMON_CURRENCY_CODES,
  COMMON_PAYMENT_MEANS_CODES,
  COMMON_UNIT_CODES,
  CREDIT_TRANSFER_MEANS_CODES,
  DIRECT_DEBIT_MEANS_CODES,
  EN16931_SPEC_ID,
  VAT_CATEGORY_CODES,
  XRECHNUNG_30_SPEC_ID,
  XRECHNUNG_TYPE_CODES,
} from './model/codes.js';

export type { Profile, Rule, Severity, Violation } from './validate/rule.js';
export { AMOUNT_TOLERANCE, amountsEqual, round2 } from './validate/rule.js';

export { EN16931_RULES } from './validate/rules/en16931.js';
export { VAT_CATEGORY_RULES } from './validate/rules/vat-categories.js';
export { XRECHNUNG_RULES } from './validate/rules/xrechnung.js';

export {
  RULESET_VERSION,
  SPEC_VERSIONS,
  rulesForProfile,
  validateInvoice,
  validateUblXml,
  validateXml,
} from './validate/index.js';
export type { Syntax, ValidateOptions, ValidateXmlResult, ValidationResult } from './validate/index.js';

export { InvoiceParseError, parseUblInvoice } from './parse/ubl.js';
export { parseCiiInvoice } from './parse/cii.js';

export { DEFAULT_PROCESS_ID, generateXRechnungUbl, withXRechnungDefaults } from './generate/ubl.js';
export type { GenerateOptions } from './generate/ubl.js';

export { computeTotals, withComputedTotals } from './generate/totals.js';
export type { ComputeTotalsOptions, ComputedTotals } from './generate/totals.js';

/**
 * Draft → EN 16931 semantic model → structured document.
 *
 * This is the only place where typed text becomes a claim on an invoice, so
 * it is where the two non-negotiables live:
 *
 *   1. **Exact arithmetic.** Every amount goes through `@stampbench/core`'s
 *      money module in integer minor units. The subtotal a user reads on
 *      screen and the BT-106 in the XML are computed by the same code from
 *      the same integers, so they cannot disagree by a cent — and a cent is
 *      what BR-CO-13 rejects a document for.
 *
 *   2. **Nothing is invented.** An empty field stays empty. The builder never
 *      fills in a VAT number, an address, a buyer reference or an exemption
 *      reason to make validation pass; it lets the document fail honestly and
 *      shows the user which rule and which field. Guessing turns "invalid"
 *      into "quietly wrong", which is the one failure mode a compliance tool
 *      must not have.
 */
import {
  add,
  fromDecimal,
  generateUblInvoice,
  lineNet as computeLineNet,
  money,
  parseMoney,
  percentOf,
  PRICE_SCALE,
  sum,
  toDecimal,
  withComputedTotals,
  withProfileDefaults,
  type Invoice,
  type InvoiceLine,
  type Money,
} from '@stampbench/core';

import { getCountry } from './countries';
import type { DraftLine, DraftParty, InvoiceDraft } from './draft';
import { getFormat } from './formats';
import { getVatCategory, type VatCategoryCode } from './tax';

/** Trim to undefined: an empty input must not become an empty XML element. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function number(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Currency scale is fixed at 2 for every currency the builder offers. */
const SCALE = 2;

export interface LineTotal {
  key: string;
  net: Money;
  vat: Money;
  categoryCode: VatCategoryCode;
  rate: number | undefined;
}

export interface CategoryTotal {
  categoryCode: VatCategoryCode;
  rate: number | undefined;
  taxable: Money;
  tax: Money;
}

export interface DraftTotals {
  lines: LineTotal[];
  categories: CategoryTotal[];
  /** BT-106 — sum of line net amounts. */
  net: Money;
  /** BT-110 — total VAT. */
  tax: Money;
  /** BT-112 — total with VAT. */
  gross: Money;
}

/**
 * The line's net amount, computed the way EN 16931 defines it: quantity ×
 * (price ÷ base quantity), rounded once. The price is held at PRICE_SCALE so
 * a genuine £0.335 unit price is not flattened to £0.34 before multiplying.
 */
export function lineNetAmount(line: DraftLine): Money {
  const price = parseMoney(line.unitPrice, PRICE_SCALE) ?? money(0, PRICE_SCALE);
  const quantity = number(line.quantity) ?? 0;
  return computeLineNet(price, quantity, 1, SCALE);
}

/**
 * Totals for display and for the document — the same numbers, once.
 *
 * VAT is computed per category group rather than per line, which is what
 * BR-S-08/09 and their siblings check: the tax on a group is the group's
 * taxable amount × the rate, not the sum of per-line roundings. Getting that
 * backwards is the single most common way a hand-built invoice fails on a
 * one-cent discrepancy.
 */
export function computeDraftTotals(draft: InvoiceDraft): DraftTotals {
  const lines: LineTotal[] = draft.lines.map((line) => {
    const category = getVatCategory(line.vatCategory);
    const rate = category.rate === 'absent' ? undefined : category.rate === 'zero' ? 0 : number(line.vatRate);
    return {
      key: line.key,
      net: lineNetAmount(line),
      // Per-line VAT is display sugar only; the document's figure comes from
      // the category group below.
      vat: percentOf(lineNetAmount(line), rate ?? 0),
      categoryCode: line.vatCategory,
      rate,
    };
  });

  const groups = new Map<string, CategoryTotal>();
  for (const line of lines) {
    const key = `${line.categoryCode}@${line.rate ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.taxable = add(existing.taxable, line.net);
    } else {
      groups.set(key, {
        categoryCode: line.categoryCode,
        rate: line.rate,
        taxable: line.net,
        tax: money(0, SCALE),
      });
    }
  }
  const categories = [...groups.values()].map((group) => ({
    ...group,
    tax: percentOf(group.taxable, group.rate ?? 0),
  }));

  const net = sum(
    lines.map((l) => l.net),
    SCALE,
  );
  const tax = sum(
    categories.map((c) => c.tax),
    SCALE,
  );
  return { lines, categories, net, tax, gross: add(net, tax) };
}

function toAddress(party: DraftParty) {
  const address = {
    streetName: text(party.street),
    additionalStreet: text(party.additionalStreet),
    city: text(party.city),
    postCode: text(party.postCode),
    countrySubdivision: text(party.subdivision),
    countryCode: text(party.countryCode),
  };
  return Object.values(address).some(Boolean) ? address : undefined;
}

function toContact(party: DraftParty) {
  const contact = {
    name: text(party.contactName),
    phone: text(party.phone),
    email: text(party.email),
  };
  return Object.values(contact).some(Boolean) ? contact : undefined;
}

function toParty(party: DraftParty) {
  const mapped = {
    name: text(party.name),
    tradingName: text(party.tradingName),
    vatId: text(party.vatId),
    taxRegistrationId: text(party.taxRegistrationId),
    legalRegistrationId: text(party.companyId),
    electronicAddress: text(party.electronicAddress),
    electronicAddressScheme: text(party.electronicAddressScheme),
    address: toAddress(party),
    contact: toContact(party),
  };
  return Object.values(mapped).some(Boolean) ? mapped : undefined;
}

function toLine(line: DraftLine, index: number): InvoiceLine {
  const category = getVatCategory(line.vatCategory);
  const price = parseMoney(line.unitPrice, PRICE_SCALE);
  const rate = category.rate === 'absent' ? undefined : category.rate === 'zero' ? 0 : number(line.vatRate);
  const mapped: InvoiceLine = {
    id: String(index + 1),
    quantity: number(line.quantity),
    unitCode: text(line.unitCode),
    // The net amount is stated explicitly so the document carries the exact
    // figure the builder displayed, rather than leaving the engine to
    // re-derive it from a price and risk a different rounding.
    netAmount: toDecimal(lineNetAmount(line)),
    item: { name: text(line.description), sellerItemId: text(line.sku) },
    vat: { categoryCode: line.vatCategory, rate },
  };
  if (price) mapped.price = { netPrice: toDecimal(price) };
  return mapped;
}

/**
 * Build the semantic model. Totals and the VAT breakdown are computed by the
 * engine (`withComputedTotals`) from the same lines, so the document satisfies
 * the BR-CO arithmetic chain by construction rather than by luck.
 */
export function toInvoiceModel(draft: InvoiceDraft): Invoice {
  const format = getFormat(draft.formatId);
  const profile = format.validationProfile ?? 'en16931';
  const country = getCountry(draft.seller.countryCode);

  const invoice: Invoice = {
    number: text(draft.document.number),
    issueDate: text(draft.document.issueDate),
    dueDate: text(draft.document.dueDate),
    typeCode: text(draft.document.typeCode),
    currencyCode: text(draft.document.currency) ?? country.currency,
    buyerReference: text(draft.document.buyerReference),
    purchaseOrderReference: text(draft.document.orderReference),
    contractReference: text(draft.document.contractReference),
    // Note: the delivery date (BT-72, BG-13) is deliberately absent. The
    // semantic model does not carry delivery information today, so putting it
    // here would silently drop it from the XML while the preview showed it —
    // the builder's field says as much rather than pretending otherwise.
    paymentTerms: text(draft.document.paymentTerms),
    seller: toParty(draft.seller),
    buyer: toParty(draft.buyer),
    lines: draft.lines.map(toLine),
  };

  const note = text(draft.document.note);
  if (note) invoice.notes = [note];

  const payment = draft.payment;
  const accountId = text(payment.accountId);
  const providerId = text(payment.providerId);
  const accountName = text(payment.accountName);
  if (text(payment.meansTypeCode) || accountId || providerId) {
    invoice.payment = {
      meansTypeCode: text(payment.meansTypeCode),
      remittanceInformation: text(payment.remittance),
    };
    if (accountId || providerId || accountName) {
      invoice.payment.creditTransfers = [
        { iban: accountId, accountName, bic: providerId },
      ];
    }
  }

  const withTotals = withComputedTotals(withProfileDefaults(invoice, { profile }));

  // Exemption reasons attach to the VAT breakdown the engine just built, so
  // they survive regrouping. Only categories that actually require one get a
  // reason, and only if the user supplied it — an unsupplied reason is left
  // missing so validation reports it rather than the builder inventing text.
  for (const group of withTotals.vatBreakdown ?? []) {
    const category = getVatCategory(group.categoryCode);
    if (category.exemptionReason !== 'required') continue;
    const reason = text(draft.exemptionReasons[group.categoryCode as VatCategoryCode]);
    if (reason) group.exemptionReason = reason;
  }

  return withTotals;
}

export interface GeneratedDocument {
  invoice: Invoice;
  /** Canonical JSON — always available, for every format. */
  json: string;
  /** UBL 2.1, when the chosen format has an XML representation. */
  xml?: string;
  /** The profile the document declares and will be validated against. */
  profile: 'en16931' | 'xrechnung' | null;
}

export function generateDocument(draft: InvoiceDraft): GeneratedDocument {
  const format = getFormat(draft.formatId);
  const invoice = toInvoiceModel(draft);
  const result: GeneratedDocument = {
    invoice,
    json: JSON.stringify({ invoice }, null, 2),
    profile: format.validationProfile,
  };
  if (format.outputs.includes('xml') && format.validationProfile) {
    result.xml = generateUblInvoice(invoice, { profile: format.validationProfile });
  }
  return result;
}

export interface RequirementCheck {
  /** The rule that will fire if this is not satisfied. */
  rule: string;
  label: string;
  met: boolean;
}

/**
 * A live checklist of what the current choices require, and whether the draft
 * has it yet.
 *
 * Every entry corresponds to a rule that is genuinely enforced by
 * `@stampbench/core` — the VAT-category `-02` family, the BR-DE requirements
 * of the German CIUS — so this is a preview of the verdict rather than a
 * separate opinion about invoices. It exists because finding out that reverse
 * charge needs the buyer's VAT identifier *after* pressing Generate is a worse
 * experience than being told while filling the form in, and because it makes
 * the requirements checkable: each one names its rule.
 */
export function requirementChecks(draft: InvoiceDraft): RequirementCheck[] {
  const format = getFormat(draft.formatId);
  const isGerman = format.validationProfile === 'xrechnung';
  const checks: RequirementCheck[] = [];
  const filled = (value: string | undefined) => Boolean(text(value));

  // Every VAT category's -02 rule wants the seller identified for tax.
  checks.push({
    rule: 'BR-{category}-02',
    label: 'Seller VAT identifier (BT-31) or tax registration (BT-32)',
    met: filled(draft.seller.vatId) || filled(draft.seller.taxRegistrationId),
  });

  const used = new Set(draft.lines.map((l) => l.vatCategory));
  for (const code of used) {
    const category = getVatCategory(code);
    if (category.buyerVatRequired) {
      checks.push({
        rule: `BR-${code}-02`,
        label: `${category.label}: buyer VAT identifier (BT-48)`,
        met: filled(draft.buyer.vatId),
      });
    }
    if (category.exemptionReason === 'required') {
      checks.push({
        rule: `BR-${code}-10`,
        label: `${category.label}: exemption reason (BT-120)`,
        met: filled(draft.exemptionReasons[code]),
      });
    }
  }

  if (isGerman) {
    checks.push(
      {
        rule: 'BR-DE-1',
        label: 'Payment instructions (BG-16)',
        met: filled(draft.payment.meansTypeCode),
      },
      {
        rule: 'BR-DE-2..4',
        label: 'Seller contact name, telephone and email (BT-41…43)',
        met: filled(draft.seller.contactName) && filled(draft.seller.phone) && filled(draft.seller.email),
      },
      {
        rule: 'BR-DE-5/6',
        label: 'Seller city and post code (BT-37, BT-38)',
        met: filled(draft.seller.city) && filled(draft.seller.postCode),
      },
      {
        rule: 'BR-DE-8/9',
        label: 'Buyer city and post code (BT-52, BT-53)',
        met: filled(draft.buyer.city) && filled(draft.buyer.postCode),
      },
      {
        rule: 'BR-DE-15',
        label: 'Buyer reference (BT-10) — the Leitweg-ID for public buyers',
        met: filled(draft.document.buyerReference),
      },
    );
  }

  return checks;
}

/**
 * Blocking problems the builder can see before the engine runs.
 *
 * Not a substitute for validation — it is the subset that produces a
 * confusing result rather than a clear violation. An invoice with no lines
 * validates to a pile of arithmetic errors that all mean "there is nothing
 * here"; saying so up front is kinder and just as honest.
 */
export function preflight(draft: InvoiceDraft): string[] {
  const problems: string[] = [];
  if (draft.lines.length === 0) problems.push('Add at least one line item.');
  if (draft.lines.every((l) => !text(l.description) && !text(l.unitPrice))) {
    problems.push('The line items are empty — add a description and a unit price.');
  }
  if (!text(draft.document.number)) problems.push('An invoice number (BT-1) is required.');
  if (!text(draft.document.issueDate)) problems.push('An issue date (BT-2) is required.');
  return problems;
}

/** Amounts as plain numbers, for the preview and the summary panel. */
export function decimals(totals: DraftTotals) {
  return {
    net: toDecimal(totals.net),
    tax: toDecimal(totals.tax),
    gross: toDecimal(totals.gross),
  };
}

export { fromDecimal, toDecimal };

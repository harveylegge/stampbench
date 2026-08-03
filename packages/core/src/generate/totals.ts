/**
 * Compute EN 16931-consistent totals (BG-22) and VAT breakdown (BG-23) from
 * invoice lines and document-level allowances/charges.
 *
 * This is the piece most hand-rolled invoice generators get wrong: BT-106
 * through BT-115 and the per-category VAT sums must satisfy the BR-CO
 * arithmetic chain exactly, or the invoice is rejected. Give this function
 * lines with quantities, prices and VAT categories, and it returns totals
 * that pass those rules by construction.
 */
import type { AllowanceCharge, Invoice, InvoiceLine, Totals, VatBreakdown } from '../model/invoice.js';
import { round2 } from '../validate/rule.js';

export interface ComputeTotalsOptions {
  /** BT-113 — amount already paid. */
  paidAmount?: number;
  /** BT-114 — rounding amount to apply to the payable total. */
  roundingAmount?: number;
}

export interface ComputedTotals {
  totals: Totals;
  vatBreakdown: VatBreakdown[];
}

function lineNet(line: InvoiceLine): number {
  if (line.netAmount !== undefined) return round2(line.netAmount);
  const qty = line.quantity ?? 0;
  const price = line.price?.netPrice ?? 0;
  const base = line.price?.baseQuantity ?? 1;
  return round2((qty * price) / (base || 1));
}

/**
 * Derive totals + VAT breakdown from lines and allowances/charges.
 * Lines without an explicit netAmount get quantity × netPrice / baseQuantity.
 */
export function computeTotals(
  lines: InvoiceLine[],
  allowancesCharges: AllowanceCharge[] = [],
  options: ComputeTotalsOptions = {},
): ComputedTotals {
  const groups = new Map<string, VatBreakdown>();
  const keyOf = (category: string | undefined, rate: number | undefined) =>
    `${category ?? '??'}@${rate ?? 0}`;

  const add = (category: string | undefined, rate: number | undefined, amount: number) => {
    const key = keyOf(category, rate);
    let g = groups.get(key);
    if (!g) {
      g = { categoryCode: category ?? '', taxableAmount: 0, taxAmount: 0 };
      if (rate !== undefined) g.rate = rate;
      groups.set(key, g);
    }
    g.taxableAmount = round2(g.taxableAmount + amount);
  };

  let sumOfLineNet = 0;
  const lineCategories = new Set<string>();
  for (const line of lines) {
    const net = lineNet(line);
    sumOfLineNet = round2(sumOfLineNet + net);
    add(line.vat?.categoryCode, line.vat?.rate, net);
    if (line.vat?.categoryCode) lineCategories.add(`${line.vat.categoryCode}@${line.vat.rate ?? 0}`);
  }

  // When a document-level allowance/charge omits its VAT category, EN 16931
  // still requires one. If every line shares a single category/rate, inherit
  // it (the common single-rate case) rather than creating an invalid
  // empty-category VAT group. Mixed rates stay unresolved so validation flags it.
  const soleCategory =
    lineCategories.size === 1 ? [...lineCategories][0]!.split('@') : null;
  const inheritedCategory = soleCategory ? soleCategory[0] : undefined;
  const inheritedRate = soleCategory ? Number(soleCategory[1]) : undefined;

  let allowanceTotal = 0;
  let chargeTotal = 0;
  for (const ac of allowancesCharges) {
    const amount = round2(ac.amount);
    const category = ac.vatCategoryCode ?? inheritedCategory;
    const rate = ac.vatCategoryCode ? ac.vatRate : (ac.vatRate ?? inheritedRate);
    if (ac.isCharge) {
      chargeTotal = round2(chargeTotal + amount);
      add(category, rate, amount);
    } else {
      allowanceTotal = round2(allowanceTotal + amount);
      add(category, rate, -amount);
    }
  }

  let taxTotal = 0;
  const vatBreakdown = [...groups.values()].map((g) => {
    const rate = g.rate ?? 0;
    const taxAmount = round2((g.taxableAmount * rate) / 100);
    taxTotal = round2(taxTotal + taxAmount);
    return { ...g, taxAmount };
  });

  const taxExclusive = round2(sumOfLineNet - allowanceTotal + chargeTotal);
  const taxInclusive = round2(taxExclusive + taxTotal);
  const paidAmount = options.paidAmount ?? 0;
  const roundingAmount = options.roundingAmount ?? 0;
  const amountDue = round2(taxInclusive - paidAmount + roundingAmount);

  const totals: Totals = {
    sumOfLineNet,
    taxExclusive,
    taxTotal,
    taxInclusive,
    amountDue,
  };
  if (allowanceTotal) totals.allowanceTotal = allowanceTotal;
  if (chargeTotal) totals.chargeTotal = chargeTotal;
  if (paidAmount) totals.paidAmount = paidAmount;
  if (roundingAmount) totals.roundingAmount = roundingAmount;

  return { totals, vatBreakdown };
}

/**
 * Convenience: return a copy of the invoice with totals and VAT breakdown
 * computed from its lines and allowances/charges. Lines that omitted their
 * net amount (BT-131) get it materialised too — the XML must state it.
 */
export function withComputedTotals(invoice: Invoice, options?: ComputeTotalsOptions): Invoice {
  const lines = (invoice.lines ?? []).map((line) =>
    line.netAmount === undefined ? { ...line, netAmount: lineNet(line) } : line,
  );
  const { totals, vatBreakdown } = computeTotals(lines, invoice.allowancesCharges ?? [], options);
  return { ...invoice, lines, totals, vatBreakdown };
}

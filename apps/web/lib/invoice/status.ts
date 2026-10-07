/**
 * Payment status, derived rather than stored.
 *
 * The only fact the user records is "I marked this paid" (`paidAt` on the
 * saved entry). Everything else: awaiting, overdue: is computed from the
 * draft's own dates at the moment of asking, so an invoice becomes overdue by
 * the calendar advancing, not by anyone remembering to update a field. Storing
 * "overdue" would create exactly the stale second copy the history module was
 * built to avoid.
 *
 * Money figures are summed in the engine's minor units straight from
 * `computeDraftTotals`: the same arithmetic the editor, the PDF and the XML
 * use: and grouped by currency, because £3,000 + €500 is not a number and
 * this module refuses to pretend it is.
 */

import { money, type Money } from '@stampbench/core';

import { computeDraftTotals } from './build';
import { getCountry } from './countries';
import type { SavedInvoice } from './history';

export type PaymentStatus = 'paid' | 'awaiting' | 'overdue';

/** ISO day for comparisons; ISO strings compare correctly as strings. */
export function isoDayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Paid wins over everything; otherwise the due date decides. An invoice due
 * today is awaiting, not overdue: a payment that arrives on the due date is
 * on time, and a tracker that shouts a day early teaches people to ignore it.
 * No due date means nothing to be late against, so it stays awaiting.
 */
export function invoiceStatus(entry: SavedInvoice, todayIso: string): PaymentStatus {
  if (entry.paidAt) return 'paid';
  const due = entry.draft.document.dueDate;
  if (due && due < todayIso) return 'overdue';
  return 'awaiting';
}

export interface CurrencySummary {
  currency: string;
  /** A locale for formatting, taken from the first invoice seen. */
  locale: string;
  /** From the same totals chain as the documents themselves. */
  invoiced: Money;
  paid: Money;
  awaiting: Money;
  overdue: Money;
  count: number;
  overdueCount: number;
}

/** Mutable accumulator; becomes a CurrencySummary once the units are final. */
interface Bucket {
  currency: string;
  locale: string;
  scale: number;
  invoiced: number;
  paid: number;
  awaiting: number;
  overdue: number;
  count: number;
  overdueCount: number;
}

/**
 * This month's business, per currency: everything issued in the current
 * calendar month, split by where it stands. Credit notes subtract: a month
 * with a £500 credit note in it has £500 less invoiced, which is what the
 * word means. Entries whose totals cannot be computed (drafts written by an
 * older build) are skipped rather than guessed at.
 *
 * Sums are integer minor units carried between the engine's own Money values
 *: every invoice in one currency shares one scale, so the arithmetic never
 * mixes exponents.
 */
export function monthSummary(entries: SavedInvoice[], now: Date): CurrencySummary[] {
  const monthPrefix = isoDayOf(now).slice(0, 7);
  const todayIso = isoDayOf(now);
  const byCurrency = new Map<string, Bucket>();

  for (const entry of entries) {
    const issued = entry.draft.document.issueDate;
    if (!issued || !issued.startsWith(monthPrefix)) continue;

    let gross: Money;
    try {
      gross = computeDraftTotals(entry.draft).gross;
    } catch {
      continue;
    }
    const units = entry.draft.document.typeCode === '381' ? -gross.units : gross.units;

    const currency = entry.draft.document.currency || 'EUR';
    let row = byCurrency.get(currency);
    if (!row) {
      row = {
        currency,
        locale: getCountry(entry.draft.seller.countryCode).locale,
        scale: gross.scale,
        invoiced: 0,
        paid: 0,
        awaiting: 0,
        overdue: 0,
        count: 0,
        overdueCount: 0,
      };
      byCurrency.set(currency, row);
    }

    row.invoiced += units;
    row.count += 1;
    const status = invoiceStatus(entry, todayIso);
    if (status === 'paid') row.paid += units;
    else if (status === 'overdue') {
      row.overdue += units;
      row.overdueCount += 1;
    } else row.awaiting += units;
  }

  // Deterministic order: the currency with the most invoices first.
  return [...byCurrency.values()]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      currency: row.currency,
      locale: row.locale,
      invoiced: money(row.invoiced, row.scale),
      paid: money(row.paid, row.scale),
      awaiting: money(row.awaiting, row.scale),
      overdue: money(row.overdue, row.scale),
      count: row.count,
      overdueCount: row.overdueCount,
    }));
}

export interface MonthPoint {
  /** Calendar month, as 'YYYY-MM'. */
  month: string;
  invoiced: Money;
  paid: Money;
  count: number;
}

export interface CurrencySeries {
  currency: string;
  /** A locale for formatting, taken from the first invoice seen. */
  locale: string;
  /** Documents in the window: decides which currency leads the chart. */
  count: number;
  /** Months in the window with at least one document. */
  activeMonths: number;
  /** Oldest first, one point per month of the window: zero months included. */
  months: MonthPoint[];
}

/**
 * The last `monthsBack` calendar months per currency: `monthSummary`'s rules
 * applied month by month, for the chart on /my-invoices. Same arithmetic:
 * integer minor units from the documents' own totals chain, credit notes
 * subtract, uncomputable drafts are skipped. A month with no invoices is a
 * real zero rather than a gap: the business did no invoicing that month, and
 * a chart that smoothed over it would be flattering, not reporting.
 */
export function monthlySeries(
  entries: SavedInvoice[],
  now: Date,
  monthsBack = 12,
): CurrencySeries[] {
  // Anchored via isoDayOf so "this month" is the same UTC month the rest of
  // the page's date handling uses.
  const anchor = isoDayOf(now);
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const keys: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    keys.push(new Date(Date.UTC(year, month - 1 - i, 1)).toISOString().slice(0, 7));
  }
  const window = new Set(keys);

  interface MonthBucket {
    invoiced: number;
    paid: number;
    count: number;
  }
  const byCurrency = new Map<
    string,
    {
      currency: string;
      locale: string;
      scale: number;
      count: number;
      months: Map<string, MonthBucket>;
    }
  >();

  for (const entry of entries) {
    const issued = entry.draft.document.issueDate;
    const key = issued ? issued.slice(0, 7) : '';
    if (!window.has(key)) continue;

    let gross: Money;
    try {
      gross = computeDraftTotals(entry.draft).gross;
    } catch {
      continue;
    }
    const units = entry.draft.document.typeCode === '381' ? -gross.units : gross.units;

    const currency = entry.draft.document.currency || 'EUR';
    let row = byCurrency.get(currency);
    if (!row) {
      row = {
        currency,
        locale: getCountry(entry.draft.seller.countryCode).locale,
        scale: gross.scale,
        count: 0,
        months: new Map(),
      };
      byCurrency.set(currency, row);
    }
    let bucket = row.months.get(key);
    if (!bucket) {
      bucket = { invoiced: 0, paid: 0, count: 0 };
      row.months.set(key, bucket);
    }
    bucket.invoiced += units;
    bucket.count += 1;
    row.count += 1;
    // Paid mirrors invoiceStatus: the mark is the only fact recorded. A paid
    // credit note subtracts here exactly as it does from "invoiced".
    if (entry.paidAt) bucket.paid += units;
  }

  return [...byCurrency.values()]
    .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency))
    .map((row) => ({
      currency: row.currency,
      locale: row.locale,
      count: row.count,
      activeMonths: row.months.size,
      months: keys.map((key) => {
        const bucket = row.months.get(key);
        return {
          month: key,
          invoiced: money(bucket?.invoiced ?? 0, row.scale),
          paid: money(bucket?.paid ?? 0, row.scale),
          count: bucket?.count ?? 0,
        };
      }),
    }));
}

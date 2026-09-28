'use client';

/**
 * How many invoices this browser has created in the current calendar month.
 *
 * Deliberately a *separate* localStorage key from `sb_invoice_history`, not a
 * count derived from it. The history is the user's own list — they can delete
 * entries from it, and rightly expect deleting an invoice to be a real delete —
 * so deriving the cap from its length would mean "delete an invoice, get
 * another one free", which is not a cap at all. This counter only ever moves
 * forward, and resets on the month boundary like every other quota in the
 * product.
 *
 * Counted per UTC calendar month using the same `currentPeriodKey` the worker
 * meters the hosted API with, so "your month" means one thing across the whole
 * product rather than two subtly different windows.
 *
 * Storage access is wrapped throughout: Safari in private mode throws on
 * localStorage, and there the counter degrades to "this session only" — the
 * same deal the draft and the history already accept. Failing open is correct
 * here; a storage error must never make the app refuse to build an invoice.
 */

import { currentPeriodKey } from '@/lib/plans';

const KEY = 'sb_invoice_quota';

/** Fired on the window when the count changes, so open pages can follow. */
export const QUOTA_EVENT = 'sb:invoice-quota';

interface QuotaRecord {
  /** The UTC month this count belongs to, e.g. "2026-08". */
  period: string;
  count: number;
}

function read(): QuotaRecord {
  const empty: QuotaRecord = { period: currentPeriodKey(), count: 0 };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof (parsed as QuotaRecord).period !== 'string' ||
      typeof (parsed as QuotaRecord).count !== 'number' ||
      !Number.isFinite((parsed as QuotaRecord).count)
    ) {
      return empty;
    }
    const record = parsed as QuotaRecord;
    // A stored count from an earlier month is spent history, not this month's
    // usage. Rolling over on read means no scheduled job is needed.
    if (record.period !== empty.period) return empty;
    return { period: record.period, count: Math.max(0, Math.floor(record.count)) };
  } catch {
    return empty;
  }
}

function write(record: QuotaRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Quota exceeded or private mode. Nothing to do: the in-memory result of
    // this call is still correct for the current page.
  }
  try {
    window.dispatchEvent(new CustomEvent(QUOTA_EVENT));
  } catch {
    /* CustomEvent is unavailable in some embedded webviews. */
  }
}

/** Invoices created in this browser during the current UTC month. */
export function invoicesUsedThisMonth(): number {
  return read().count;
}

/**
 * Record one created invoice and return the new count.
 *
 * Called at the moment an invoice is actually produced, not when the generator
 * is opened — editing a draft for an hour costs nothing, and re-exporting an
 * invoice already counted must not charge for it twice (the caller passes the
 * invoice through `alreadyCounted` for that).
 */
export function countInvoice(): number {
  const record = read();
  const next: QuotaRecord = { period: record.period, count: record.count + 1 };
  write(next);
  return next.count;
}

/**
 * Ids already counted this month, so that re-creating or re-exporting the same
 * invoice does not consume a second slot.
 *
 * Kept alongside the count rather than inside the history for the same reason
 * the count is: deleting the invoice must not refund the slot.
 */
const SEEN_KEY = 'sb_invoice_quota_seen';

function readSeen(): { period: string; ids: string[] } {
  const empty = { period: currentPeriodKey(), ids: [] as string[] };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as { period?: unknown; ids?: unknown };
    if (typeof parsed?.period !== 'string' || !Array.isArray(parsed.ids)) return empty;
    if (parsed.period !== empty.period) return empty;
    return { period: parsed.period, ids: parsed.ids.filter((id): id is string => typeof id === 'string') };
  } catch {
    return empty;
  }
}

/**
 * Count an invoice unless this id has already been counted this month.
 * Returns true when a slot was consumed.
 */
export function countInvoiceOnce(id: string): boolean {
  const seen = readSeen();
  if (seen.ids.includes(id)) return false;
  // Cap the id list so a heavy month cannot walk the origin into its quota;
  // the count itself is authoritative, this list only prevents double-counting
  // the invoice someone is actively re-exporting.
  const ids = [id, ...seen.ids].slice(0, 200);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify({ period: seen.period, ids }));
    } catch {
      /* see write() */
    }
  }
  countInvoice();
  return true;
}

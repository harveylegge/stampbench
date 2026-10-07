'use client';

/**
 * The browser-local invoice history behind /my-invoices.
 *
 * Deliberately not a server feature: the product's privacy promise is that an
 * invoice never leaves the browser, and a "my invoices" list that quietly
 * uploaded every document to make itself work would break that promise in the
 * one place people would least expect it. The list lives in localStorage,
 * next to the draft it grew out of.
 *
 * Each entry keeps the full draft rather than a summary. The draft is the
 * source of truth everywhere else: totals, preview and XML are all derived
 * from it: so storing derived figures here would create a second copy that
 * could disagree with what reopening the invoice shows.
 *
 * Every storage access is wrapped: Safari in private mode throws on
 * localStorage, and the history degrades to "this session only" there, which
 * is the same deal the draft already accepts.
 */

import { isMarketId } from '@/lib/markets';
import type { InvoiceDraft } from './draft';

const KEY = 'sb_invoice_history';

/** Fired on the window when the history changes, so open pages can follow. */
export const HISTORY_EVENT = 'sb:invoice-history';

/**
 * Newest first. Capped so a heavy user with logos on every invoice cannot
 * walk the whole origin into its storage quota.
 */
const MAX_ENTRIES = 50;

export interface SavedInvoice {
  id: string;
  /**
   * When it was last created/re-created *or otherwise changed*, epoch ms.
   * This is also the sync clock: backup pushes an entry when the account's
   * copy is older than this, so anything that must reach other devices:
   * including marking paid: has to bump it.
   */
  savedAt: number;
  /**
   * When the user marked it paid, epoch ms; absent/null means unpaid.
   * A timestamp rather than a boolean so "overdue" can stay derived: an
   * invoice is overdue exactly when it is unpaid past its due date, computed
   * from the draft's own dates instead of stored where it could go stale.
   */
  paidAt?: number | null;
  draft: InvoiceDraft;
}

function read(): SavedInvoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Same poison-proofing as the generator's loadDraft: a cross-version or
    // corrupted entry must not be able to take the whole list down with it,
    // and MARKETS[draft.market] is dereferenced on every row.
    return parsed.filter(
      (entry): entry is SavedInvoice =>
        !!entry &&
        typeof (entry as SavedInvoice).id === 'string' &&
        typeof (entry as SavedInvoice).savedAt === 'number' &&
        !!(entry as SavedInvoice).draft &&
        Array.isArray((entry as SavedInvoice).draft.lines) &&
        isMarketId((entry as SavedInvoice).draft.market),
    );
  } catch {
    return [];
  }
}

function write(entries: SavedInvoice[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Quota pressure is real here: logos are data URLs. Shedding the oldest
    // entries until the write fits keeps the recent history alive instead of
    // losing the invoice that was just created.
    let list = entries;
    for (;;) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(list));
        break;
      } catch (e) {
        if (list.length === 0) throw e;
        list = list.slice(0, -1);
      }
    }
  } catch {
    // Storage unavailable. The list still lives in memory for this page view.
  }
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function listInvoices(): SavedInvoice[] {
  return read();
}

export function getInvoice(id: string): SavedInvoice | null {
  return read().find((entry) => entry.id === id) ?? null;
}

/**
 * Record a created invoice, newest first.
 *
 * Upserts on the invoice number: creating, going back to the editor and
 * creating again is one invoice being finished, not two invoices: and an
 * entry per attempt would bury the list in near-duplicates. Two genuinely
 * different documents that share a number collapse to the latest, which is
 * also what a numbering series is supposed to mean.
 */
export function saveInvoice(draft: InvoiceDraft): SavedInvoice {
  const entries = read();
  const existing = entries.find(
    (entry) => entry.draft.document.number === draft.document.number,
  );
  const entry: SavedInvoice = {
    id: existing?.id ?? `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    // Re-creating an invoice is finishing it, not issuing a new one: an
    // already-paid invoice that gets its address corrected stays paid.
    paidAt: existing?.paidAt ?? null,
    draft,
  };
  const rest = entries.filter((e) => e.id !== entry.id);
  write([entry, ...rest].slice(0, MAX_ENTRIES));
  return entry;
}

/**
 * Mark an invoice paid (or unpaid again). Bumps savedAt on purpose: that is
 * the sync clock, and a paid mark that never reached your other devices would
 * make the whole status feature untrustworthy. The list itself is sorted by
 * issue date, so the bump does not reorder anything visible.
 */
export function setInvoicePaid(id: string, paid: boolean): SavedInvoice | null {
  const entries = read();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) return null;
  const updated: SavedInvoice = {
    ...entries[index]!,
    paidAt: paid ? Date.now() : null,
    savedAt: Date.now(),
  };
  entries[index] = updated;
  write(entries);
  return updated;
}

export function deleteInvoice(id: string): void {
  write(read().filter((entry) => entry.id !== id));
}

/**
 * Fold invoices pulled from the account into the local list. An incoming
 * entry wins only when it is newer than what this browser already has, so a
 * sync can never quietly roll back local work.
 */
export function mergeInvoices(incoming: SavedInvoice[]): void {
  if (incoming.length === 0) return;
  const byId = new Map(read().map((entry) => [entry.id, entry]));
  let changed = false;
  for (const entry of incoming) {
    const current = byId.get(entry.id);
    if (!current || entry.savedAt > current.savedAt) {
      byId.set(entry.id, entry);
      changed = true;
    }
  }
  if (!changed) return;
  write(
    [...byId.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_ENTRIES),
  );
}

/** Subscribe to changes, including from another tab. Returns an unsubscribe. */
export function onHistoryChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) handler();
  };
  window.addEventListener(HISTORY_EVENT, handler);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(HISTORY_EVENT, handler);
    window.removeEventListener('storage', onStorage);
  };
}

// ------------------------------------------------------------------ handoff

const RESUME_KEY = 'sb_invoice_resume';

/**
 * "Open" on /my-invoices: put the saved draft where the generator already
 * looks, flag the handoff, navigate. Session-scoped like the playground's
 * `sb_playground_xml`: a stale flag surviving into next week's visit would
 * skip the market step for no reason the visitor remembers.
 */
export function stageForEditing(draft: InvoiceDraft): void {
  try {
    window.localStorage.setItem('sb_invoice_draft', JSON.stringify(draft));
    window.sessionStorage.setItem(RESUME_KEY, '1');
  } catch {
    // Private mode. The generator opens on its market step instead: a
    // survivable outcome for a convenience handoff.
  }
}

/** One-shot: true exactly once after stageForEditing, then cleared. */
export function consumeResumeFlag(): boolean {
  try {
    const flagged = window.sessionStorage.getItem(RESUME_KEY) === '1';
    if (flagged) window.sessionStorage.removeItem(RESUME_KEY);
    return flagged;
  } catch {
    return false;
  }
}

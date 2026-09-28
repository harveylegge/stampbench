'use client';

/**
 * Backing up "My invoices" to the account — strictly opt-in.
 *
 * The site's standing promise is that invoices live in the browser unless you
 * choose otherwise. This module is the "otherwise": once switched on, every
 * invoice you create is also saved to your Stampbench account, so the list
 * follows you to any browser you sign in on. Switching it on is one click;
 * so is switching it off.
 *
 * Two deliberate limits:
 *  - Logos are not uploaded. They are print-only decoration, they are big,
 *    and the invoice is complete without them — an invoice opened on another
 *    device simply asks for its logo again.
 *  - Sync failures are silent-but-recoverable. The local list is always the
 *    thing you see; the backup catches up on the next visit rather than
 *    interrupting invoice work with retry dialogs.
 *
 * This account list is also where auto-created invoices (from payments or
 * forwarded emails) will appear once those triggers exist.
 */

import { formatMoney } from '@stampbench/core';

import {
  deleteAccountInvoice,
  getAccountInvoice,
  listAccountInvoices,
  probablySignedIn,
  saveAccountInvoice,
} from '@/lib/account-client';
import { computeDraftTotals } from '@/lib/invoice/build';
import { getCountry } from '@/lib/invoice/countries';
import type { InvoiceDraft } from '@/lib/invoice/draft';
import { mergeInvoices, type SavedInvoice } from '@/lib/invoice/history';
import { isMarketId } from '@/lib/markets';

const FLAG = 'sb_invoice_backup';

export function backupEnabled(): boolean {
  try {
    return window.localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export function setBackupEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(FLAG, '1');
    else window.localStorage.removeItem(FLAG);
  } catch {
    // Storage unavailable — the toggle simply will not stick, and the UI
    // reads backupEnabled() so it never claims otherwise.
  }
}

/** Backup is live: chosen, and by someone who appears to be signed in. */
export function backupActive(): boolean {
  return backupEnabled() && probablySignedIn();
}

function accountBody(entry: SavedInvoice) {
  const { draft } = entry;
  let total = '';
  try {
    const currency = draft.document.currency || 'EUR';
    total = formatMoney(computeDraftTotals(draft).gross, currency, getCountry(draft.seller.countryCode).locale);
  } catch {
    // A draft that will not total still deserves a backup row — the editor
    // is where it gets fixed, on whichever device opens it.
  }
  const slim: InvoiceDraft = { ...draft, logo: undefined };
  return {
    payload: JSON.stringify(slim),
    number: draft.document.number,
    customer: draft.buyer.name,
    total,
    currency: draft.document.currency || '',
    market: draft.market,
    // The paid mark travels in the status column rather than the payload:
    // old rows parse as bare drafts, and this keeps them doing so.
    status: entry.paidAt ? 'paid' : 'created',
  };
}

/** Push one invoice to the account. Quiet on failure — sync catches up later. */
export async function pushInvoice(entry: SavedInvoice): Promise<void> {
  try {
    await saveAccountInvoice(entry.id, accountBody(entry));
  } catch {
    // See module comment: the local copy is safe, retry happens on next sync.
  }
}

/** Remove one invoice from the account. 404 (never uploaded) is fine. */
export async function removeAccountCopy(id: string): Promise<void> {
  try {
    await deleteAccountInvoice(id);
  } catch {
    // Either it was never backed up or the network blinked — both survivable.
  }
}

/**
 * Full two-way catch-up:
 *  1. every local invoice the account is missing (or has older) is pushed;
 *  2. every account invoice this browser is missing — or holds an older copy
 *     of — is pulled and merged.
 * The "or older" clause is what carries changes to *existing* invoices
 * between devices: without it, marking an invoice paid on one machine would
 * push fine and then never land anywhere else, because the other machines
 * already "have" the entry. mergeInvoices keeps newest-wins, so a pull can
 * still never roll back local work.
 * Returns how many arrived from the account, so the page can refresh its list.
 */
export async function syncWithAccount(local: SavedInvoice[]): Promise<number> {
  const { invoices: remote } = await listAccountInvoices();
  const remoteById = new Map(remote.map((r) => [r.id, r]));

  await Promise.all(
    local
      .filter((entry) => {
        const r = remoteById.get(entry.id);
        return !r || r.updatedAt < entry.savedAt;
      })
      .map((entry) => pushInvoice(entry)),
  );

  const localById = new Map(local.map((entry) => [entry.id, entry]));
  const missing = remote.filter((r) => {
    const mine = localById.get(r.id);
    return !mine || r.updatedAt > mine.savedAt;
  });
  const pulled: SavedInvoice[] = [];
  for (const summary of missing) {
    try {
      const { invoice } = await getAccountInvoice(summary.id);
      const draft = JSON.parse(invoice.payload) as InvoiceDraft;
      if (!draft || !Array.isArray(draft.lines) || !isMarketId(draft.market)) continue;
      pulled.push({
        id: summary.id,
        savedAt: invoice.updatedAt,
        // The exact mark-as-paid moment is not stored server-side; the row's
        // update time is the closest honest stand-in, and nothing computes
        // with paidAt beyond "is it set". 'auto' is a webhook-created row
        // (worker payment-hook.ts) — born from a received payment, so it
        // arrives already paid.
        paidAt: invoice.status === 'paid' || invoice.status === 'auto' ? invoice.updatedAt : null,
        draft,
      });
    } catch {
      // Skip the one that failed; the rest of the pull still lands.
    }
  }
  mergeInvoices(pulled);
  return pulled.length;
}

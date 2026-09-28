/**
 * Customers and services, derived from the invoices you have already made.
 *
 * Deliberately not a second database. The address book is a *view over the
 * history*: every buyer you have invoiced is a customer, every line you have
 * billed is a service, rebuilt from the saved drafts each time the generator
 * opens. There is nothing to maintain, nothing to migrate, and nothing to
 * drift — and because the history is what the account backup syncs, the book
 * follows you to another device for free the moment the invoices do.
 *
 * The cost of that choice is honest too: you "add a customer" by invoicing
 * them once, and there is no editing a customer except by editing an invoice.
 * For the freelancer this exists for, that is the natural motion anyway.
 */

import type { DraftLine, DraftParty } from './draft';
import type { SavedInvoice } from './history';

export interface KnownCustomer {
  /** Display name — the buyer's name as last invoiced. */
  name: string;
  /** The full party block, ready to drop into a draft. */
  party: DraftParty;
  /** How many saved invoices carry this customer. */
  invoiceCount: number;
}

export interface KnownService {
  description: string;
  unitPrice: string;
  unitCode: string;
  vatCategory: DraftLine['vatCategory'];
  vatRate: string;
  sku: string;
}

const MAX_ENTRIES = 100;

/** Newest-first, so "the details as last invoiced" is what wins. */
function newestFirst(entries: SavedInvoice[]): SavedInvoice[] {
  return [...entries].sort((a, b) => b.savedAt - a.savedAt);
}

export function knownCustomers(entries: SavedInvoice[]): KnownCustomer[] {
  const byName = new Map<string, KnownCustomer>();
  for (const entry of newestFirst(entries)) {
    const name = entry.draft.buyer.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.invoiceCount += 1;
      continue;
    }
    if (byName.size >= MAX_ENTRIES) continue;
    byName.set(key, {
      name,
      // Copied, not referenced: the picker hands this object to the editor,
      // and the editor mutates its draft freely.
      party: { ...entry.draft.buyer },
      invoiceCount: 1,
    });
  }
  return [...byName.values()];
}

/**
 * Every distinct line description ever billed, with the price and tax setup
 * it last carried. Lines without a description are half-typed rows, and lines
 * without a price teach the autofill nothing — both are skipped.
 */
export function knownServices(entries: SavedInvoice[]): KnownService[] {
  const byDescription = new Map<string, KnownService>();
  for (const entry of newestFirst(entries)) {
    for (const line of entry.draft.lines) {
      const description = line.description.trim();
      if (!description || !line.unitPrice.trim()) continue;
      const key = description.toLowerCase();
      if (byDescription.has(key) || byDescription.size >= MAX_ENTRIES) continue;
      byDescription.set(key, {
        description,
        unitPrice: line.unitPrice,
        unitCode: line.unitCode,
        vatCategory: line.vatCategory,
        vatRate: line.vatRate,
        sku: line.sku,
      });
    }
  }
  return [...byDescription.values()];
}

/** Case-insensitive exact match — what picking from a datalist produces. */
export function findService(services: KnownService[], description: string): KnownService | null {
  const key = description.trim().toLowerCase();
  if (!key) return null;
  return services.find((service) => service.description.toLowerCase() === key) ?? null;
}

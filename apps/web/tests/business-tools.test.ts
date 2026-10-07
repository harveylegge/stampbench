/**
 * The business-tools layer: duplication, payment status, the month summary,
 * recurring schedules and the derived customer/service book.
 *
 * All pure logic: dates and "now" are injected everywhere, so nothing here
 * depends on when the suite runs.
 */
import { describe, expect, it } from 'vitest';

import { findService, knownCustomers, knownServices } from '@/lib/invoice/book';
import { bumpInvoiceNumber, duplicateDraft, emptyDraft } from '@/lib/invoice/draft';
import type { SavedInvoice } from '@/lib/invoice/history';
import { firstFutureDue, nextDueDate } from '@/lib/invoice/recurring';
import { invoiceStatus, monthSummary } from '@/lib/invoice/status';

const NOW = new Date('2026-08-15T12:00:00Z');

/** A saved entry around a draft, with the knobs the tests turn. */
function entry(
  overrides: {
    number?: string;
    issueDate?: string;
    dueDate?: string;
    paidAt?: number | null;
    currency?: string;
    typeCode?: string;
    buyerName?: string;
    price?: string;
    description?: string;
    savedAt?: number;
  } = {},
): SavedInvoice {
  const draft = emptyDraft('uk', NOW);
  draft.document.number = overrides.number ?? 'INV-2026-000001';
  draft.document.issueDate = overrides.issueDate ?? '2026-08-10';
  draft.document.dueDate = overrides.dueDate ?? '2026-09-09';
  if (overrides.currency) draft.document.currency = overrides.currency;
  if (overrides.typeCode) draft.document.typeCode = overrides.typeCode;
  draft.buyer.name = overrides.buyerName ?? 'Halden Retail Group';
  draft.lines[0]!.description = overrides.description ?? 'Data platform review';
  draft.lines[0]!.unitPrice = overrides.price ?? '100';
  return {
    id: `id-${overrides.number ?? 'x'}-${overrides.savedAt ?? 0}`,
    savedAt: overrides.savedAt ?? 1_000,
    paidAt: overrides.paidAt ?? null,
    draft,
  };
}

describe('bumpInvoiceNumber', () => {
  it('increments the trailing run of digits and keeps its padding', () => {
    expect(bumpInvoiceNumber('INV-2026-000421')).toBe('INV-2026-000422');
    expect(bumpInvoiceNumber('42')).toBe('43');
    expect(bumpInvoiceNumber('A-9')).toBe('A-10');
  });

  it('increments digits even when a suffix follows them', () => {
    expect(bumpInvoiceNumber('2026-17-DE')).toBe('2026-18-DE');
  });

  it('appends -2 when there are no digits at all', () => {
    expect(bumpInvoiceNumber('DRAFT')).toBe('DRAFT-2');
  });

  it('skips past numbers that already exist', () => {
    const taken = new Set(['INV-2', 'INV-3']);
    expect(bumpInvoiceNumber('INV-1', taken)).toBe('INV-4');
  });

  it('survives digit runs too long for a float', () => {
    expect(bumpInvoiceNumber('INV-9007199254740993')).toBe('INV-9007199254740994');
  });
});

describe('duplicateDraft', () => {
  it('advances the number, moves to today and keeps the payment window', () => {
    const source = entry({ number: 'INV-2026-000421', issueDate: '2026-07-01', dueDate: '2026-07-15' });
    const copy = duplicateDraft(source.draft, NOW);
    expect(copy.document.number).toBe('INV-2026-000422');
    expect(copy.document.issueDate).toBe('2026-08-15');
    expect(copy.document.dueDate).toBe('2026-08-29'); // the same 14 days
  });

  it('clears what a new invoice cannot have inherited', () => {
    const source = entry({});
    source.draft.amountPaid = '50';
    source.draft.document.deliveryDate = '2026-08-01';
    const copy = duplicateDraft(source.draft, NOW);
    expect(copy.amountPaid).toBe('');
    expect(copy.document.deliveryDate).toBe('');
  });

  it('keeps the commercial content and reissues line keys', () => {
    const source = entry({ description: 'Retainer', price: '250' });
    const copy = duplicateDraft(source.draft, NOW);
    expect(copy.lines[0]!.description).toBe('Retainer');
    expect(copy.lines[0]!.unitPrice).toBe('250');
    expect(copy.lines[0]!.key).not.toBe(source.draft.lines[0]!.key);
    expect(copy.buyer.name).toBe(source.draft.buyer.name);
  });

  it('falls back to 30 days when the source dates do not parse', () => {
    const source = entry({ issueDate: '', dueDate: '' });
    const copy = duplicateDraft(source.draft, NOW);
    expect(copy.document.issueDate).toBe('2026-08-15');
    expect(copy.document.dueDate).toBe('2026-09-14');
  });
});

describe('invoiceStatus', () => {
  const today = '2026-08-15';

  it('paid beats every date', () => {
    expect(invoiceStatus(entry({ dueDate: '2020-01-01', paidAt: 5 }), today)).toBe('paid');
  });

  it('unpaid past due is overdue; due today is still awaiting', () => {
    expect(invoiceStatus(entry({ dueDate: '2026-08-14' }), today)).toBe('overdue');
    expect(invoiceStatus(entry({ dueDate: '2026-08-15' }), today)).toBe('awaiting');
    expect(invoiceStatus(entry({ dueDate: '2026-08-16' }), today)).toBe('awaiting');
  });

  it('no due date means nothing to be late against', () => {
    expect(invoiceStatus(entry({ dueDate: '' }), today)).toBe('awaiting');
  });
});

describe('monthSummary', () => {
  it('buckets the current month by status, per currency', () => {
    const entries = [
      entry({ number: 'A-1', issueDate: '2026-08-01', dueDate: '2026-08-10' }), // overdue
      entry({ number: 'A-2', issueDate: '2026-08-05', paidAt: 5 }), // paid
      entry({ number: 'A-3', issueDate: '2026-08-12', dueDate: '2026-09-11' }), // awaiting
      entry({ number: 'OLD', issueDate: '2026-07-30' }), // last month: excluded
      entry({ number: 'E-1', issueDate: '2026-08-09', currency: 'EUR' }),
    ];
    const summary = monthSummary(entries, NOW);
    expect(summary).toHaveLength(2);

    const gbp = summary.find((row) => row.currency === 'GBP')!;
    expect(gbp.count).toBe(3);
    expect(gbp.overdueCount).toBe(1);
    // Every bucket is the same £100 + 20% VAT invoice, in minor units.
    expect(gbp.paid.units).toBe(12_000);
    expect(gbp.overdue.units).toBe(12_000);
    expect(gbp.awaiting.units).toBe(12_000);
    expect(gbp.invoiced.units).toBe(36_000);

    expect(summary.find((row) => row.currency === 'EUR')!.count).toBe(1);
  });

  it('credit notes subtract from the month', () => {
    const entries = [
      entry({ number: 'A-1', issueDate: '2026-08-01', paidAt: 5 }),
      entry({ number: 'CN-1', issueDate: '2026-08-02', typeCode: '381', paidAt: 5 }),
    ];
    const summary = monthSummary(entries, NOW);
    expect(summary[0]!.invoiced.units).toBe(0);
  });
});

describe('recurring dates', () => {
  it('steps by cadence', () => {
    expect(nextDueDate('2026-08-15', 'weekly')).toBe('2026-08-22');
    expect(nextDueDate('2026-08-15', 'monthly')).toBe('2026-09-15');
    expect(nextDueDate('2026-08-15', 'quarterly')).toBe('2026-11-15');
    expect(nextDueDate('2026-08-15', 'yearly')).toBe('2027-08-15');
  });

  it('clamps to short months without losing the anchor day', () => {
    // Jan 31 → Feb 28 → (anchored) Mar 31, not Mar 28.
    const feb = nextDueDate('2026-01-31', 'monthly');
    expect(feb).toBe('2026-02-28');
    expect(nextDueDate(feb, 'monthly', 31)).toBe('2026-03-31');
  });

  it('handles year boundaries and leap years', () => {
    expect(nextDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
    expect(nextDueDate('2027-02-28', 'yearly', 29)).toBe('2028-02-29'); // leap
    expect(nextDueDate('2028-02-29', 'yearly')).toBe('2029-02-28');
  });

  it('firstFutureDue walks an old start date past today', () => {
    expect(firstFutureDue('2026-03-10', 'monthly', '2026-08-15')).toBe('2026-09-10');
    // A start later than today still lands one cadence on, in the future.
    expect(firstFutureDue('2026-08-20', 'monthly', '2026-08-15')).toBe('2026-09-20');
  });
});

describe('the book', () => {
  it('derives customers newest-first with the latest details winning', () => {
    const entries = [
      entry({ number: 'A-1', buyerName: 'Acme Ltd', savedAt: 1 }),
      entry({ number: 'A-2', buyerName: 'acme ltd', savedAt: 5 }), // newer casing wins
      entry({ number: 'B-1', buyerName: 'Borealis GmbH', savedAt: 3 }),
      entry({ number: 'X-1', buyerName: '', savedAt: 9 }), // nameless: skipped
    ];
    const customers = knownCustomers(entries);
    expect(customers.map((c) => c.name)).toEqual(['acme ltd', 'Borealis GmbH']);
    expect(customers[0]!.invoiceCount).toBe(2);
  });

  it('copies the party rather than referencing the stored draft', () => {
    const source = entry({ buyerName: 'Acme Ltd' });
    const customers = knownCustomers([source]);
    customers[0]!.party.name = 'Mutated';
    expect(source.draft.buyer.name).toBe('Acme Ltd');
  });

  it('derives services and skips half-typed lines', () => {
    const entries = [
      entry({ number: 'A-1', description: 'Website design', price: '800', savedAt: 5 }),
      entry({ number: 'A-2', description: 'Website design', price: '900', savedAt: 1 }), // older: loses
      entry({ number: 'A-3', description: 'Unpriced thing', price: '', savedAt: 4 }),
    ];
    const services = knownServices(entries);
    expect(services).toHaveLength(1);
    expect(services[0]!.unitPrice).toBe('800');
  });

  it('findService matches exactly and case-insensitively, never on prefixes', () => {
    const services = knownServices([entry({ description: 'Website design', price: '800' })]);
    expect(findService(services, 'website DESIGN')?.unitPrice).toBe('800');
    expect(findService(services, 'Website')).toBeNull();
    expect(findService(services, '')).toBeNull();
  });
});

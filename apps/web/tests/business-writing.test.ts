/**
 * The template-based business tools: chase emails, the roast rules and the
 * hours importer. All pure — text in, text out — with the money arithmetic
 * (statutory interest, summed hours) pinned hardest, because those are the
 * numbers that end up quoted at other people.
 */
import { describe, expect, it } from 'vitest';

import { money } from '@stampbench/core';

import {
  chaseEmail,
  defaultToneFor,
  statutoryCharges,
  type ChaseDetails,
} from '@/lib/invoice/chase';
import { groupHours, parseDuration, parseHoursLog } from '@/lib/invoice/hours';
import { roastInvoice } from '@/lib/roast';

// ------------------------------------------------------------------- chase

const DETAILS: ChaseDetails = {
  invoiceNumber: 'INV-2026-000042',
  buyerCompany: 'Halden Retail Group',
  contactName: 'Priya Sharma',
  amount: '£1,200.00',
  issueDate: '2026-07-01',
  dueDate: '2026-07-31',
  daysOverdue: 21,
  sellerName: 'Harvey Legge',
};

describe('statutoryCharges', () => {
  it('applies base + 8% per year, per day, on the gross debt', () => {
    // £1,000.00 at 12% (4 base + 8) for 365 days = £120.00 exactly.
    const charges = statutoryCharges(money(100_000, 2), 365, 4)!;
    expect(charges.ratePct).toBe(12);
    expect(charges.interest.units).toBe(12_000);
  });

  it('tiers the fixed compensation at £1,000 and £10,000', () => {
    expect(statutoryCharges(money(99_999, 2), 10, 4)!.compensation.units).toBe(4_000);
    expect(statutoryCharges(money(100_000, 2), 10, 4)!.compensation.units).toBe(7_000);
    expect(statutoryCharges(money(1_000_000, 2), 10, 4)!.compensation.units).toBe(10_000);
  });

  it('adds debt, interest and compensation into the new total', () => {
    const charges = statutoryCharges(money(100_000, 2), 365, 4)!;
    expect(charges.totalDue.units).toBe(100_000 + 12_000 + 7_000);
  });

  it('refuses nonsense inputs rather than guessing', () => {
    expect(statutoryCharges(money(100_000, 2), 0, 4)).toBeNull();
    expect(statutoryCharges(money(100_000, 2), 10, NaN)).toBeNull();
    expect(statutoryCharges(money(100_000, 2), 10, -1)).toBeNull();
    expect(statutoryCharges(money(100_000, 2), 10, 26)).toBeNull();
    expect(statutoryCharges(money(0, 2), 10, 4)).toBeNull();
  });
});

describe('chaseEmail', () => {
  it('escalates the default tone with age', () => {
    expect(defaultToneFor(3)).toBe('friendly');
    expect(defaultToneFor(21)).toBe('firm');
    expect(defaultToneFor(60)).toBe('final');
  });

  it('puts the facts in every tone', () => {
    for (const tone of ['friendly', 'firm', 'final'] as const) {
      const email = chaseEmail(tone, 'en', DETAILS);
      expect(email.subject).toContain('INV-2026-000042');
      expect(email.body).toContain('£1,200.00');
      expect(email.body).toContain('Hi Priya,');
      expect(email.body).toContain('Harvey Legge');
    }
  });

  it('cites the Act only when statutory figures are supplied', () => {
    const plain = chaseEmail('final', 'en', DETAILS);
    expect(plain.body).not.toContain('Late Payment of Commercial Debts');

    const withCharges = chaseEmail('final', 'en', {
      ...DETAILS,
      statutory: {
        interest: '£8.28',
        compensation: '£70.00',
        totalDue: '£1,278.28',
        ratePct: 12,
        days: 21,
      },
    });
    expect(withCharges.body).toContain('Late Payment of Commercial Debts (Interest) Act 1998');
    expect(withCharges.body).toContain('£1,278.28');
  });

  it('writes a formal German Mahnung, Sie throughout', () => {
    const email = chaseEmail('firm', 'de', DETAILS);
    expect(email.subject).toContain('Mahnung');
    expect(email.body).toContain('Sie');
    expect(email.body).not.toMatch(/\bdu\b/i);
  });

  it('survives an empty contact and an uncomputable amount', () => {
    const email = chaseEmail('friendly', 'en', {
      ...DETAILS,
      contactName: '',
      amount: '',
    });
    expect(email.body).toContain('Hello Halden Retail Group,');
    expect(email.body).toContain('the outstanding amount');
  });

  it('states the accrual on the firm tone when statutory figures are supplied', () => {
    const email = chaseEmail('firm', 'en', {
      ...DETAILS,
      statutory: {
        interest: '£8.28',
        compensation: '£70.00',
        totalDue: '£1,278.28',
        ratePct: 12,
        days: 21,
      },
    });
    expect(email.body).toContain('has begun accruing statutory interest');
    expect(email.body).toContain('£1,278.28');
  });

  it('tolerates cross-version drafts whose contact field is missing entirely', () => {
    const email = chaseEmail('friendly', 'en', {
      ...DETAILS,
      contactName: undefined as unknown as string,
    });
    expect(email.body).toContain('Hello Halden Retail Group,');
  });
});

// ------------------------------------------------------------------- roast

const SOLID_INVOICE = `Invoice INV-2026-000123
Issued 2026-08-01 · Due 2026-08-31 — payment within 30 days
Consulting: API integration, 14 hours @ £95 — £1,330.00
VAT (20%): £266.00
Total due: £1,596.00 GBP
Pay by bank transfer — sort code 12-34-56, account 12345678.
Late payments incur statutory interest.`;

const HORROR_INVOICE = `hi! so sorry to bother you, whenever you get a chance,
here's what you owe:
- work
- various services
it comes to 1200, no rush at all, hope that's ok!!`;

describe('roastInvoice', () => {
  it('finds nothing to roast on a solid invoice', () => {
    const result = roastInvoice(SOLID_INVOICE);
    expect(result.score).toBe(10);
    expect(result.findings).toHaveLength(0);
    expect(result.praise.length).toBeGreaterThan(0);
  });

  it('takes the horror show apart, worst problems first', () => {
    const result = roastInvoice(HORROR_INVOICE);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('no-due-date');
    expect(ids).toContain('no-payment-details');
    expect(ids).toContain('no-currency');
    expect(ids).toContain('grovelling');
    expect(ids).toContain('vague-lines');
    expect(result.score).toBeLessThanOrEqual(3);
    // Sorted by severity: the un-payable problems outrank the style points.
    const severities = result.findings.map((f) => f.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
  });

  it('is deterministic: the same paste gets the same jokes', () => {
    expect(roastInvoice(HORROR_INVOICE)).toEqual(roastInvoice(HORROR_INVOICE));
  });

  it('calls a text message a text message', () => {
    const result = roastInvoice('you owe me £50');
    expect(result.findings[0]!.id).toBe('too-short');
    expect(result.score).toBe(1);
  });

  it('recognises German invoices: grouped IBAN, Überweisung, compound labels', () => {
    const german = `Rechnung Nr. 2026/001
Fälligkeitsdatum: 15.09.2026 · Umsatzsteuer 19%
Gesamtsumme: 1.190,00 €
Bitte zahlen Sie per Überweisung.
DE89 3704 0044 0532 0130 00 — Volksbank Berlin`;
    const ids = roastInvoice(german).findings.map((f) => f.id);
    expect(ids).not.toContain('no-payment-details');
    expect(ids).not.toContain('no-due-date');
    expect(ids).not.toContain('no-total');
    expect(ids).not.toContain('no-invoice-number');
  });

  it('recognises month-first dates and slash invoice numbers', () => {
    const american = `Invoice No. INV/2026/001 — issued Aug 21, 2026, due September 20, 2026
Consulting retainer: $2,000. Total due: $2,000 USD by wire transfer (routing 021000021).`;
    const ids = roastInvoice(american).findings.map((f) => f.id);
    expect(ids).not.toContain('no-dates');
    expect(ids).not.toContain('no-invoice-number');
  });
});

// ------------------------------------------------------------------- hours

describe('parseDuration', () => {
  it('reads the formats trackers export', () => {
    expect(parseDuration('1:30')).toBeCloseTo(1.5);
    expect(parseDuration('01:30:00')).toBeCloseTo(1.5);
    expect(parseDuration('3.5')).toBeCloseTo(3.5);
    expect(parseDuration('3,5')).toBeCloseTo(3.5); // German decimal comma
    expect(parseDuration('3.5h')).toBeCloseTo(3.5);
    expect(parseDuration('2h 15m')).toBeCloseTo(2.25);
    expect(parseDuration('45m')).toBeCloseTo(0.75);
  });

  it('refuses what is not a duration', () => {
    expect(parseDuration('yesterday')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });
});

describe('parseHoursLog + groupHours', () => {
  it('parses a Toggl-style CSV and groups by project', () => {
    const csv = `Project,Description,Duration
Website,Homepage hero,2:30
Website,Deploy fixes,1:00
API,Webhook handler,3:15`;
    const parsed = parseHoursLog(csv);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.skipped).toBe(0);

    const groups = groupHours(parsed.entries);
    expect(groups).toHaveLength(2);
    // Biggest first, hours summed in code.
    expect(groups[0]).toMatchObject({ description: 'Website', hours: 3.5, entries: 2 });
    expect(groups[1]).toMatchObject({ description: 'API', hours: 3.25, entries: 1 });
  });

  it('parses a plain pasted log, stripping dates and bullets', () => {
    const log = `- 2026-08-12: homepage redesign 3.5h
1:30 deploy fixes
45m standup calls
a line with no time on it`;
    const parsed = parseHoursLog(log);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.skipped).toBe(1);
    expect(parsed.entries[0]).toMatchObject({ description: 'homepage redesign', hours: 3.5 });
    expect(parsed.entries[2]!.hours).toBeCloseTo(0.75);
  });

  it('groups identical descriptions case-insensitively when there is no project', () => {
    const parsed = parseHoursLog(`1h Standup calls
2h standup calls`);
    const groups = groupHours(parsed.entries);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.hours).toBe(3);
  });

  it('bills the whole compound duration, not just the hours half', () => {
    const parsed = parseHoursLog(`2h 15m code review
2 hours 30 minutes on API`);
    expect(parsed.entries[0]).toMatchObject({ description: 'code review', hours: 2.25 });
    expect(parsed.entries[1]!.hours).toBeCloseTo(2.5);
  });

  it('reads clock ranges as spans, not start times', () => {
    const parsed = parseHoursLog(`9:00-10:30 client call
22:30-01:00 overnight deploy`);
    expect(parsed.entries[0]).toMatchObject({ description: 'client call', hours: 1.5 });
    expect(parsed.entries[1]!.hours).toBeCloseTo(2.5); // rolls over midnight
  });

  it('skips a line claiming more than a day rather than billing it', () => {
    const parsed = parseHoursLog('25:00 mystery marathon');
    expect(parsed.entries).toHaveLength(0);
    expect(parsed.skipped).toBe(1);
  });

  it('reports lines beyond the entry cap instead of silently dropping them', () => {
    const log = Array.from({ length: 1005 }, (_, i) => `1h task ${i}`).join('\n');
    const parsed = parseHoursLog(log);
    expect(parsed.entries).toHaveLength(1000);
    expect(parsed.truncated).toBe(5);
  });
});

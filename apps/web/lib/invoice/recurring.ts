'use client';

/**
 * Recurring invoices, v1: a schedule and a prompt, not a robot.
 *
 * A rule says "this invoice repeats monthly". When its date comes around and
 * the user next opens /my-invoices, they are offered the ready-made invoice:
 * one click opens the editor prefilled with the next number in the series and
 * today's dates. Nothing is created without them present.
 *
 * That limit is deliberate, twice over. Creating invoices unattended needs the
 * drafts server-side and something to wake up on schedule: infrastructure
 * that exists only behind the opt-in backup: and an invoice that issues
 * itself while nobody is looking is also the kind of surprise a numbering
 * series does not forgive. The rule store is the part that will not change
 * when true background automation arrives; the trigger is.
 *
 * Rules live in localStorage beside the history they point into. They are not
 * yet backed up to the account: a rule references a local invoice id, and a
 * rule arriving on a device without its source invoice would be a prompt that
 * cannot do anything.
 */

export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const CADENCES: { id: Cadence; label: string; noun: string }[] = [
  { id: 'weekly', label: 'Repeats weekly', noun: 'weekly' },
  { id: 'monthly', label: 'Repeats monthly', noun: 'monthly' },
  { id: 'quarterly', label: 'Repeats quarterly', noun: 'quarterly' },
  { id: 'yearly', label: 'Repeats yearly', noun: 'yearly' },
];

export interface RecurringRule {
  id: string;
  /** The history entry this repeats. */
  invoiceId: string;
  cadence: Cadence;
  /** ISO day the next invoice is due to be created. */
  nextDue: string;
  createdAt: number;
}

const KEY = 'sb_recurring';

/** Fired on the window when the rules change, so open pages can follow. */
export const RECURRING_EVENT = 'sb:recurring';

// ------------------------------------------------------------------ dates

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * One step along the schedule. Month-based cadences clamp to the shorter
 * month and *stay anchored to the original day*: an invoice that goes out on
 * the 31st lands on Feb 28 in February and returns to the 31st in March,
 * instead of sliding to the 28th forever after the first short month. That is
 * why this takes the anchor day separately rather than reading it off the
 * date being advanced.
 */
export function nextDueDate(fromIso: string, cadence: Cadence, anchorDay?: number): string {
  const { y, m, d } = parts(fromIso);
  const day = anchorDay ?? d;
  if (cadence === 'weekly') {
    const next = new Date(Date.UTC(y, m - 1, d) + 7 * 86_400_000);
    return next.toISOString().slice(0, 10);
  }
  const months = cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : 12;
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return toIso(year, month, Math.min(day, daysInMonth(year, month)));
}

/** The first due date strictly after `todayIso`, stepping from `startIso`. */
export function firstFutureDue(startIso: string, cadence: Cadence, todayIso: string): string {
  const anchor = parts(startIso).d;
  let due = nextDueDate(startIso, cadence, anchor);
  // Bounded: even a weekly rule anchored years back walks forward in <1k steps.
  for (let i = 0; due <= todayIso && i < 5_000; i++) due = nextDueDate(due, cadence, anchor);
  return due;
}

// ---------------------------------------------------------------- storage

function read(): RecurringRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (rule): rule is RecurringRule =>
        !!rule &&
        typeof (rule as RecurringRule).id === 'string' &&
        typeof (rule as RecurringRule).invoiceId === 'string' &&
        typeof (rule as RecurringRule).nextDue === 'string' &&
        CADENCES.some((c) => c.id === (rule as RecurringRule).cadence),
    );
  } catch {
    return [];
  }
}

function write(rules: RecurringRule[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rules));
  } catch {
    // Private mode: the rule holds for this page view only. The invoices
    // themselves are never at risk here: this store is only the schedule.
  }
  window.dispatchEvent(new Event(RECURRING_EVENT));
}

export function listRules(): RecurringRule[] {
  return read();
}

export function ruleForInvoice(invoiceId: string): RecurringRule | null {
  return read().find((rule) => rule.invoiceId === invoiceId) ?? null;
}

/**
 * Create or change the schedule for an invoice. `startIso` is the invoice's
 * issue date; the first prompt lands one cadence after it, skipped forward
 * past today so scheduling an old invoice does not fire instantly.
 */
export function setRule(invoiceId: string, cadence: Cadence, startIso: string, todayIso: string): RecurringRule {
  const rules = read().filter((rule) => rule.invoiceId !== invoiceId);
  const rule: RecurringRule = {
    id: `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    invoiceId,
    cadence,
    nextDue: firstFutureDue(startIso, cadence, todayIso),
    createdAt: Date.now(),
  };
  write([rule, ...rules]);
  return rule;
}

export function removeRuleForInvoice(invoiceId: string): void {
  const rules = read();
  const kept = rules.filter((rule) => rule.invoiceId !== invoiceId);
  if (kept.length !== rules.length) write(kept);
}

/** Step a rule past its current due date (created or skipped: same move). */
export function advanceRule(id: string, todayIso: string): void {
  const rules = read();
  const rule = rules.find((r) => r.id === id);
  if (!rule) return;
  rule.nextDue = firstFutureDue(rule.nextDue, rule.cadence, todayIso);
  write(rules);
}

/**
 * Rules whose date has come, restricted to invoices that still exist: and
 * orphans of deleted invoices are dropped for good while we are looking,
 * so they cannot pile up invisibly forever.
 */
export function dueRules(existingInvoiceIds: ReadonlySet<string>, todayIso: string): RecurringRule[] {
  const rules = read();
  const kept = rules.filter((rule) => existingInvoiceIds.has(rule.invoiceId));
  if (kept.length !== rules.length) write(kept);
  return kept.filter((rule) => rule.nextDue <= todayIso);
}

/** Subscribe to rule changes, including from another tab. */
export function onRecurringChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) handler();
  };
  window.addEventListener(RECURRING_EVENT, handler);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(RECURRING_EVENT, handler);
    window.removeEventListener('storage', onStorage);
  };
}

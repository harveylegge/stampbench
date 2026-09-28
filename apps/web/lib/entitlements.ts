/**
 * What a plan actually buys a *business* user.
 *
 * `plans.ts` next door describes plans in marketing terms and meters the
 * hosted API. This file is the enforcement table for the browser-side business
 * tools — the generator, My invoices, recurring, the customer book — which
 * until now checked the plan for exactly one thing (the PDF watermark) and
 * handed everything else out free.
 *
 * Two rules govern anything added here:
 *
 *  1. **The acquisition path stays free.** Validating a file, fixing it, and
 *     the open-source library are never gated — that promise is load-bearing
 *     and is repeated on /pricing, /trust and the homepage. What is gated is
 *     *running a business on it*: volume, recurrence, and the memory of who
 *     owes you what.
 *  2. **Gates are honest, not hostile.** Every limit here is stated on
 *     /pricing before signup, the wall names the number, and hitting it never
 *     destroys work — a capped user can still open, edit and export every
 *     invoice they already made. A cap that eats someone's data is a refund
 *     conversation, not an upgrade.
 *
 * Enforcement is client-side because the generator is client-side; that is a
 * deliberate trade, not an oversight. The privacy promise ("your invoice never
 * leaves the browser") is worth more than a cap that a determined user could
 * bypass with devtools anyway. The account-backed limits that *do* matter for
 * cost — API quota, stored backups — are enforced in the worker, where they
 * belong.
 */

import type { PlanId } from './plans';

export interface BusinessEntitlements {
  /** Invoices creatable per calendar month; -1 = unlimited. */
  monthlyInvoices: number;
  /** Recurring invoice schedules (lib/invoice/recurring.ts). */
  recurring: boolean;
  /** The derived customer book (lib/invoice/book.ts). */
  customerBook: boolean;
  /** Marking paid, and the overdue view built on it (lib/invoice/status.ts). */
  paymentTracking: boolean;
  /** PDF without the "Made with Stampbench" line. */
  cleanPdf: boolean;
  /**
   * The inbound payment webhook (worker payment-hook.ts). The worker enforces
   * this too — it refuses to mint hooks for free plans and ignores deliveries
   * to a downgraded account's hook; this flag is what the settings UI reads.
   */
  autoInvoicing: boolean;
  /**
   * The site-wide assistant widget. Enforced in the worker as well (an AI
   * call costs real money); this flag only decides which panel the widget
   * shows before the first request.
   */
  aiChat: boolean;
}

/**
 * Free is capped at five invoices a month.
 *
 * Chosen to sit just under a real micro-business's monthly rhythm rather than
 * as a teaser: someone invoicing two or three clients a month never hits it
 * and keeps a genuinely useful free tool, while anyone actually running on
 * Stampbench reaches the wall in their first month. A cap nobody reaches sells
 * nothing; a cap of one makes the free tier a demo and kills the top of the
 * funnel that currently produces every signup.
 */
export const BUSINESS_ENTITLEMENTS: Record<PlanId, BusinessEntitlements> = {
  free: {
    monthlyInvoices: 5,
    recurring: false,
    customerBook: false,
    paymentTracking: false,
    cleanPdf: false,
    autoInvoicing: false,
    aiChat: false,
  },
  starter: {
    monthlyInvoices: -1,
    recurring: true,
    customerBook: true,
    paymentTracking: true,
    cleanPdf: true,
    autoInvoicing: true,
    aiChat: true,
  },
  pro: {
    monthlyInvoices: -1,
    recurring: true,
    customerBook: true,
    paymentTracking: true,
    cleanPdf: true,
    autoInvoicing: true,
    aiChat: true,
  },
  scale: {
    monthlyInvoices: -1,
    recurring: true,
    customerBook: true,
    paymentTracking: true,
    cleanPdf: true,
    autoInvoicing: true,
    aiChat: true,
  },
};

/**
 * Entitlements for a plan id, defaulting to Free.
 *
 * `null` means "signed out or not yet known", which resolves to Free for the
 * same reason the PDF branding does: an unknown plan must never accidentally
 * hand out the paid experience.
 */
export function entitlementsFor(plan: PlanId | null | undefined): BusinessEntitlements {
  return BUSINESS_ENTITLEMENTS[(plan as PlanId) ?? 'free'] ?? BUSINESS_ENTITLEMENTS.free;
}

/** True when this plan may create another invoice having made `used` so far. */
export function mayCreateInvoice(plan: PlanId | null | undefined, used: number): boolean {
  const cap = entitlementsFor(plan).monthlyInvoices;
  return cap < 0 || used < cap;
}

/**
 * The features a free user is missing, in the order they are worth paying for.
 * Used to build the upgrade wall's copy from one list rather than restating it
 * at each call site, where the two would drift apart.
 */
export const PAID_BUSINESS_FEATURES = [
  'Unlimited invoices every month',
  'Recurring invoices that build themselves',
  'Invoices that mark themselves paid when the money arrives',
  'Your customer book, filled in from past invoices',
  'Mark invoices paid and see what is overdue',
  'One-click chase emails, from friendly nudge to final notice',
  'The Stampbench assistant, on every page',
  'Clean PDFs with no "Made with Stampbench" line',
] as const;

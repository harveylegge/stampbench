/**
 * PayPal — the payment step of the manual upgrade path.
 *
 * This module is deliberately small, because the current integration is
 * deliberately small. A PayPal.me or payment link carries no reliable buyer
 * reference back to us and fires no webhook we can trust, so it cannot grant
 * a plan on its own: the durable record stays the D1 upgrade_requests row and
 * activation stays a human step. What the link buys is the thing that was
 * actually costing conversions — the wait between "I want to upgrade" and
 * "I can give you money", which used to be however long an email round trip
 * took.
 *
 * True unattended recurring billing is a different PayPal product
 * (Subscriptions: catalog products, billing plans, and BILLING.SUBSCRIPTION.*
 * webhooks). That is the eventual destination and it belongs in its own
 * module beside stripe.ts, with the same rule the Stripe path already
 * follows: only a verified server-side signal may change a plan.
 */

export interface PaypalConfig {
  /** A PayPal.me handle. The plan price is appended. */
  me?: string;
  /** Per-plan payment or subscription links. These win where present. */
  starter?: string;
  pro?: string;
  scale?: string;
}

/** Monthly price per paid plan, in whole pounds. Mirrors lib/plans.ts. */
const PRICE_GBP: Record<string, number> = { starter: 29, pro: 99, scale: 299 };

/**
 * Build the public link a customer should pay at, or null when PayPal is not
 * configured for that plan.
 *
 * Accepts a PayPal.me handle in any of the forms someone might paste —
 * `harveylegge`, `@harveylegge`, or the full `https://paypal.me/harveylegge`
 * — because the value comes from a human typing into a secrets UI, and a
 * doubled prefix would produce a dead link that fails silently at exactly the
 * wrong moment.
 */
export function paypalLink(config: PaypalConfig, plan: string): string | null {
  const explicit =
    plan === 'starter' ? config.starter
    : plan === 'pro' ? config.pro
    : plan === 'scale' ? config.scale
    : undefined;
  if (explicit) return explicit;

  if (!config.me) return null;
  const handle = config.me
    .trim()
    .replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  const price = PRICE_GBP[plan];
  if (!handle || !price) return null;
  return `https://www.paypal.me/${encodeURIComponent(handle)}/${price}GBP`;
}

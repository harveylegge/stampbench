/**
 * The two pure decisions in the billing path: *is this webhook genuinely from
 * Stripe*, and *what plan does this subscription grant*.
 *
 * They live apart from the router so they can be unit-tested without standing
 * up a Worker, a database, or the Anthropic SDK. Both are the kind of code
 * where a subtle mistake is invisible in manual testing and expensive in
 * production — a signature check that accepts anything hands out free
 * upgrades, and a plan mapping that guesses wrong bills the wrong tier — so
 * they are worth the seam.
 */
import { hmacSha256Hex, timingSafeEqual } from './auth';

/** Loose shape for the Stripe JSON we read; the API sends far more than this. */
export type StripeObject = Record<string, unknown>;

/** Tolerance for `Stripe-Signature`'s timestamp, matching Stripe's own default. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Verify a `Stripe-Signature` header against the raw request body.
 *
 * Stripe signs `<timestamp>.<raw body>`, so the body must be the exact bytes
 * received — parsing and re-serialising the JSON changes whitespace and key
 * order and invalidates the MAC.
 *
 * Three things have to hold, and dropping any one of them is a real hole:
 *
 *  - the MAC matches, compared in constant time so a near-miss is not
 *    distinguishable by response latency;
 *  - the header may carry several `v1` values (Stripe sends one per active
 *    endpoint secret during a rotation), and *any* match is acceptance;
 *  - the timestamp is recent. Without this a single captured delivery could be
 *    replayed forever to re-grant a plan, because the MAC over it stays valid
 *    for as long as the endpoint secret does.
 */
export async function stripeSignatureValid(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!header || !secret) return false;

  let timestamp = '';
  const candidates: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) candidates.push(value);
  }
  if (!timestamp || candidates.length === 0) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  if (Math.abs(nowMs / 1000 - sent) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  // Not short-circuiting on the first match keeps the work constant across
  // however many candidate signatures the header carried.
  let matched = false;
  for (const candidate of candidates) {
    if (timingSafeEqual(candidate, expected)) matched = true;
  }
  return matched;
}

/**
 * The plan a subscription grants, read from `metadata.plan_id` on its price.
 *
 * Keeping the mapping on the Stripe object rather than in a hardcoded price-id
 * table means a price created in the dashboard works without a redeploy. An
 * unrecognised or absent id returns null — the caller treats that as "grants
 * nothing", so a misconfigured price fails closed to the free tier instead of
 * silently handing out the wrong entitlement.
 */
export function planFromSubscription(
  subscription: StripeObject,
  knownPlans: readonly string[],
): string | null {
  const items = (subscription.items as StripeObject | undefined)?.data;
  if (!Array.isArray(items) || items.length === 0) return null;
  const price = (items[0] as StripeObject | undefined)?.price as StripeObject | undefined;
  const planId = (price?.metadata as StripeObject | undefined)?.plan_id;
  if (typeof planId !== 'string') return null;
  if (!knownPlans.includes(planId) || planId === 'free') return null;
  return planId;
}

/** Subscription statuses that entitle an account to its paid plan. */
export function subscriptionEntitles(status: unknown): boolean {
  // `past_due` is deliberately excluded: Stripe retries a failed card for
  // weeks, and serving the paid tier throughout is unpaid service.
  return status === 'active' || status === 'trialing';
}

/**
 * Whether a subscription event may change this account's plan.
 *
 * Stripe does not promise delivery order, and it retries for days — so a
 * `customer.subscription.deleted` for a subscription the customer *replaced*
 * can land after the replacement is already active. Applying it blindly
 * downgrades someone who is paying, and nothing re-grants the plan until the
 * next event on the new subscription, which for a healthy monthly
 * subscription may be a month away.
 *
 * The rule: a non-entitling event only speaks for the subscription the
 * account is actually on. An entitling one always applies — it is a live
 * subscription reporting itself, and it becomes the account's current one.
 */
export function subscriptionApplies(
  eventSubscriptionId: string,
  entitled: boolean,
  currentSubscriptionId: string | null | undefined,
): boolean {
  if (entitled) return true;
  // Nothing recorded yet: there is no newer subscription to protect.
  if (!currentSubscriptionId) return true;
  return eventSubscriptionId === currentSubscriptionId;
}

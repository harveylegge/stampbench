/**
 * PayPal Subscriptions — the recurring half of the PayPal integration.
 *
 * `paypal.ts` next door is the *manual* path: a PayPal.me or payment link that
 * lets someone pay immediately, after which a human activates the plan. It
 * cannot do more than that, because a PayPal.me payment carries no reliable
 * buyer reference and fires no event we could trust.
 *
 * This module is the opposite: PayPal's own Subscriptions product, which is
 * the only one of PayPal's four payment surfaces that actually recurs without
 * the customer consciously paying again each month. Everything here exists to
 * support one rule, the same rule the Stripe path follows — **only a verified
 * server-side signal may change a plan**. The browser can start a subscription
 * and it can be redirected back with any query string it likes; neither grants
 * anything.
 *
 * Three decisions are worth knowing before changing this file:
 *
 *  1. **`custom_id` is the link back to an account.** PayPal has no metadata
 *     bag on a subscription and no notion of our user ids. `custom_id` is set
 *     at creation time and echoed on every later event, so it is the only
 *     durable way to answer "whose subscription is this?". Losing it means
 *     reconciling payments by hand.
 *  2. **Plan ids come from configuration, not from PayPal.** A billing plan
 *     (`P-…`) carries no field we can stamp our plan id onto, so the mapping
 *     lives in environment variables written by `scripts/paypal-setup.mjs`.
 *     An unrecognised plan id grants nothing rather than guessing a tier.
 *  3. **Webhook verification is an API call, not an HMAC.** PayPal signs with
 *     RSA over a certificate chain; its published verification endpoint is the
 *     supported way to check that, and getting a hand-rolled version subtly
 *     wrong would hand out free upgrades to anyone who can POST.
 */
import type { PlanId } from '../../../apps/web/lib/plans';

/** Credentials and environment for the REST API. */
export interface PaypalCreds {
  clientId: string;
  secret: string;
  /** 'sandbox' points every call at PayPal's test environment. */
  env: 'live' | 'sandbox';
}

/** PayPal billing-plan ids (`P-…`) per internal plan. */
export interface PaypalPlanIds {
  starter?: string;
  pro?: string;
  scale?: string;
}

export type PaypalJson = Record<string, unknown>;

const API_BASE = {
  live: 'https://api-m.paypal.com',
  sandbox: 'https://api-m.sandbox.paypal.com',
} as const;

export function paypalApiBase(creds: PaypalCreds): string {
  return API_BASE[creds.env];
}

/** The PayPal billing plan a given internal plan subscribes to. */
export function paypalPlanIdFor(plans: PaypalPlanIds, plan: PlanId): string | null {
  const id =
    plan === 'starter' ? plans.starter
    : plan === 'pro' ? plans.pro
    : plan === 'scale' ? plans.scale
    : undefined;
  return id && id.trim() ? id.trim() : null;
}

/**
 * The internal plan a PayPal billing plan grants, or null.
 *
 * Fails closed in both directions that matter: an unknown `P-…` id grants
 * nothing (so a plan created by hand in the PayPal dashboard, or one left over
 * from sandbox testing, cannot quietly entitle a tier), and an unconfigured
 * slot never matches — otherwise two empty strings would compare equal and
 * every unknown subscription would resolve to whichever plan was unset.
 */
export function planFromPaypalPlanId(plans: PaypalPlanIds, paypalPlanId: unknown): PlanId | null {
  if (typeof paypalPlanId !== 'string' || !paypalPlanId.trim()) return null;
  const id = paypalPlanId.trim();
  for (const plan of ['starter', 'pro', 'scale'] as const) {
    const configured = paypalPlanIdFor(plans, plan);
    if (configured && configured === id) return plan;
  }
  return null;
}

/**
 * Subscription statuses that entitle an account to its paid plan.
 *
 * Only ACTIVE. The rest are all states where money is not currently arriving:
 * APPROVAL_PENDING and APPROVED mean the buyer has not finished (or PayPal has
 * not charged) yet, SUSPENDED is where PayPal parks a subscription whose
 * payments keep failing, and CANCELLED/EXPIRED are over. Serving a paid tier
 * through any of them is unpaid service — the same reason the Stripe path
 * refuses `past_due`.
 */
export function paypalSubscriptionEntitles(status: unknown): boolean {
  return status === 'ACTIVE';
}

/**
 * Whether a non-entitling event may take this account's plan away.
 *
 * PayPal may only revoke what PayPal is currently granting. An event about any
 * other subscription — one superseded by a resubscribe, or one that never
 * activated because the buyer abandoned the approval page — must not downgrade
 * an account that something else is entitling, including a plan Harvey
 * activated by hand through the manual path.
 *
 * This matters because PayPal does not order its deliveries and retries them
 * for days, so an old CANCELLED can land well after a new subscription is live.
 */
export function revokeApplies(
  storedSubscriptionId: string | null | undefined,
  eventSubscriptionId: string,
): boolean {
  return Boolean(storedSubscriptionId) && storedSubscriptionId === eventSubscriptionId;
}

/**
 * The subscription id an event concerns, or null when it concerns none.
 *
 * BILLING.SUBSCRIPTION.* events carry it as `resource.id`. Renewal payments
 * arrive as PAYMENT.SALE.COMPLETED, whose resource is a *sale* — there the
 * subscription is `billing_agreement_id`, and reading `id` would give the sale
 * id and silently match nothing.
 */
export function subscriptionIdFromEvent(event: PaypalJson): string | null {
  const type = String(event.event_type ?? '');
  const resource = (event.resource as PaypalJson | undefined) ?? {};
  const id =
    type.startsWith('BILLING.SUBSCRIPTION.')
      ? resource.id
      : (resource.billing_agreement_id ?? resource.id);
  return typeof id === 'string' && id ? id : null;
}

/**
 * Whether an event should cause us to re-read the subscription and re-apply
 * entitlement.
 *
 * Deliberately a small allow-list rather than "anything subscription-shaped".
 * PayPal sends a wide catalogue of events, several of them about the *plan* or
 * the *product* rather than a customer's subscription, and treating an unknown
 * event as actionable is how a webhook handler ends up doing something nobody
 * intended.
 *
 * Note what is absent: BILLING.SUBSCRIPTION.CREATED. A subscription exists in
 * APPROVAL_PENDING before the buyer has agreed to anything, so acting on it
 * would mean granting a plan to someone who merely clicked Subscribe.
 */
export const SUBSCRIPTION_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED',
] as const;

export function isSubscriptionEvent(type: unknown): boolean {
  return typeof type === 'string' && (SUBSCRIPTION_EVENTS as readonly string[]).includes(type);
}

// ------------------------------------------------------------ signatures

/** The headers PayPal signs a delivery with. */
export interface PaypalSignatureHeaders {
  authAlgo: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  transmissionSig: string | null;
  transmissionTime: string | null;
}

export function readSignatureHeaders(headers: Headers): PaypalSignatureHeaders {
  return {
    authAlgo: headers.get('paypal-auth-algo'),
    certUrl: headers.get('paypal-cert-url'),
    transmissionId: headers.get('paypal-transmission-id'),
    transmissionSig: headers.get('paypal-transmission-sig'),
    transmissionTime: headers.get('paypal-transmission-time'),
  };
}

/**
 * The certificate PayPal points at must be PayPal's own.
 *
 * `cert_url` arrives in an attacker-controllable header and is handed to
 * PayPal's verifier, which does check it — but a URL that is not on paypal.com
 * can never verify anyway, so refusing it here costs nothing and keeps a
 * forged delivery from turning into an outbound request driven by a stranger.
 * Matched on the parsed host, not a substring: `paypal.com.evil.test` contains
 * the string and is not PayPal.
 */
export function certUrlIsPaypal(certUrl: string | null): boolean {
  if (!certUrl) return false;
  let host: string;
  try {
    const url = new URL(certUrl);
    if (url.protocol !== 'https:') return false;
    host = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === 'paypal.com' || host.endsWith('.paypal.com');
}

/**
 * Build the body for `/v1/notifications/verify-webhook-signature`.
 *
 * The raw delivery body is spliced in verbatim rather than parsed and
 * re-serialised, because the signature covers the exact bytes PayPal sent.
 * `JSON.parse` followed by `JSON.stringify` is not the identity function —
 * it renormalises number formatting, non-ASCII escapes and key order — and any
 * of those differences makes a genuine delivery fail verification. Everything
 * around it is a header value, so it goes through JSON.stringify to be escaped
 * properly.
 */
export function verificationRequestBody(
  headers: PaypalSignatureHeaders,
  webhookId: string,
  rawBody: string,
): string {
  const field = (name: string, value: string) => `${JSON.stringify(name)}:${JSON.stringify(value)}`;
  return (
    '{' +
    [
      field('auth_algo', headers.authAlgo ?? ''),
      field('cert_url', headers.certUrl ?? ''),
      field('transmission_id', headers.transmissionId ?? ''),
      field('transmission_sig', headers.transmissionSig ?? ''),
      field('transmission_time', headers.transmissionTime ?? ''),
      field('webhook_id', webhookId),
      `"webhook_event":${rawBody}`,
    ].join(',') +
    '}'
  );
}

// ------------------------------------------------------------ API client

interface CachedToken {
  token: string;
  /** Epoch ms after which the token must not be reused. */
  expiresAt: number;
}

/**
 * OAuth tokens last ~9 hours, so minting one per request would add a round
 * trip to every call for no reason. The cache is per-isolate and therefore
 * best-effort — Workers isolates come and go — which is exactly the right
 * lifetime for a credential nothing else needs to share.
 */
const tokenCache = new Map<string, CachedToken>();

/** Discard a cached token — used when PayPal rejects it as unauthorised. */
export function forgetPaypalToken(creds: PaypalCreds): void {
  tokenCache.delete(`${creds.env}:${creds.clientId}`);
}

async function accessToken(creds: PaypalCreds, nowMs: number): Promise<string | null> {
  const cacheKey = `${creds.env}:${creds.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) return cached.token;

  const res = await fetch(`${paypalApiBase(creds)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${creds.clientId}:${creds.secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    console.error('paypal: token request failed', res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;
  // Expire a minute early so a token cannot go stale mid-flight.
  const ttlMs = Math.max(60, Number(body.expires_in ?? 3600) - 60) * 1000;
  tokenCache.set(cacheKey, { token: body.access_token, expiresAt: nowMs + ttlMs });
  return body.access_token;
}

export interface PaypalResponse {
  ok: boolean;
  status: number;
  body: PaypalJson;
}

/**
 * One authenticated PayPal REST call.
 *
 * Returns a result object rather than throwing: every caller here has a
 * meaningful thing to do with a failure (refuse the upgrade, ask PayPal to
 * retry the webhook, treat a 404 subscription as gone), and an exception would
 * flatten those into one.
 */
export async function paypalRequest(
  creds: PaypalCreds,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: PaypalJson,
  nowMs: number = Date.now(),
): Promise<PaypalResponse> {
  const token = await accessToken(creds, nowMs);
  if (!token) return { ok: false, status: 0, body: { error: 'token' } };

  const send = (bearer: string) =>
    fetch(`${paypalApiBase(creds)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        // PayPal replays a retried write rather than repeating it. Creating a
        // second live subscription for one customer is exactly the kind of
        // duplicate that turns into a refund conversation.
        ...(method === 'POST' ? { 'PayPal-Request-Id': crypto.randomUUID() } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  let res = await send(token);
  // A cached token can outlive its credentials — for instance after the
  // client secret is rotated. One retry with a fresh token turns that from an
  // outage lasting the isolate's lifetime into a single slow request.
  if (res.status === 401) {
    forgetPaypalToken(creds);
    const fresh = await accessToken(creds, nowMs);
    if (fresh) res = await send(fresh);
  }

  let parsed: PaypalJson = {};
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text) as PaypalJson;
    } catch {
      // 204 No Content is the documented success for cancellation, and error
      // pages from an edge fault are not JSON either.
      parsed = {};
    }
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

/**
 * Ask PayPal whether a delivery is genuinely theirs.
 *
 * Fails closed on every path: a missing header, a certificate URL that is not
 * PayPal's, a non-200 from the verifier, or any verification_status other than
 * the literal SUCCESS all return false. This function is the only thing
 * standing between a forged POST and a free plan upgrade.
 */
export async function paypalWebhookVerified(
  creds: PaypalCreds,
  webhookId: string,
  headers: PaypalSignatureHeaders,
  rawBody: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!webhookId) return false;
  if (!headers.authAlgo || !headers.transmissionId || !headers.transmissionSig || !headers.transmissionTime) {
    return false;
  }
  if (!certUrlIsPaypal(headers.certUrl)) return false;

  const token = await accessToken(creds, nowMs);
  if (!token) return false;

  const res = await fetch(`${paypalApiBase(creds)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: verificationRequestBody(headers, webhookId, rawBody),
  });
  if (!res.ok) {
    console.error('paypal: verification call failed', res.status, (await res.text()).slice(0, 300));
    return false;
  }
  const body = (await res.json()) as { verification_status?: string };
  return body.verification_status === 'SUCCESS';
}

/** The link a buyer must be sent to in order to approve a new subscription. */
export function approvalUrl(subscription: PaypalJson): string | null {
  const links = subscription.links;
  if (!Array.isArray(links)) return null;
  for (const link of links as Array<PaypalJson>) {
    if (link?.rel === 'approve' && typeof link.href === 'string') return link.href;
  }
  return null;
}

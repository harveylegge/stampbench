'use client';

/**
 * Browser-side client for the account API served by the Cloudflare Pages
 * worker (out/_worker.js, source in workers/api). Same-origin: the worker
 * intercepts /api/* on stampbench.com and the session travels in an HttpOnly
 * cookie, so every call here uses credentials: 'include' and plain JSON.
 *
 * Every function either returns the parsed payload or throws ApiError with
 * `code` for the cases the UI branches on:
 *   'unauthenticated' — no/expired session → send the visitor to /signin
 *   'quota'           — feature limit reached → upsell to /account
 */

import type { FeatureId, PlanId } from './plans';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface Me {
  email: string;
  plan: PlanId;
  createdAt: number;
  usage: Record<FeatureId, { used: number; limit: number }>;
  pendingUpgrade: PlanId | null;
  billing: {
    /** Card payment is configured server-side; false = fall back to Request upgrade. */
    enabled: boolean;
    /** A subscription is currently entitling this account. */
    subscribed: boolean;
    /** Has billing history, so the Stripe portal has something to show. */
    hasCustomer: boolean;
    /** Self-serve PayPal subscriptions are configured server-side. */
    paypalSubscriptions: boolean;
    /** A PayPal subscription is currently entitling this account. */
    paypalSubscribed: boolean;
  };
}

export interface ApiKeySummary {
  id: string;
  prefix: string;
  createdAt: number;
  lastUsed: number | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  let data: { error?: { code?: string; message?: string } } & Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON error body (e.g. HTML from an edge error page)
  }
  if (!res.ok) {
    throw new ApiError(
      data.error?.message ?? `Request failed (${res.status})`,
      data.error?.code ?? 'unknown',
      res.status,
    );
  }
  return data as T;
}

/** null when nobody is signed in — the one 401 that is not exceptional. */
export async function me(): Promise<Me | null> {
  try {
    return await call<Me>('/api/auth/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/**
 * True when the JS-readable session marker is present. The real session
 * cookie is HttpOnly; this marker exists so per-pageview chrome (the nav)
 * can skip the /api/auth/me round-trip for anonymous visitors entirely —
 * a traffic spike must not turn into a worker invocation per page view.
 */
export function probablySignedIn(): boolean {
  return typeof document !== 'undefined' && document.cookie.includes('sb_signed_in=1');
}

let planPromise: Promise<PlanId | null> | null = null;

/**
 * The signed-in account's plan, or null when signed out — cached for the page
 * view so plan-gated touches (PDF branding, backup copy) do not each cost a
 * worker call. An error is not cached: the next asker retries.
 */
export function currentPlan(): Promise<PlanId | null> {
  if (!probablySignedIn()) return Promise.resolve(null);
  planPromise ??= me()
    .then((account) => account?.plan ?? null)
    .catch(() => {
      planPromise = null;
      return null;
    });
  return planPromise;
}

export function register(email: string, password: string, termsAccepted: boolean): Promise<Me> {
  return call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, termsAccepted, termsVersion: '2026-09-28' }),
  });
}

export function login(email: string, password: string): Promise<Me> {
  return call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logout(): Promise<{ ok: true }> {
  return call('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
}

export function listKeys(): Promise<{ keys: ApiKeySummary[] }> {
  return call('/api/keys');
}

/** The full key appears only in this response — it is stored hashed. */
export function createKey(): Promise<{ key: string; id: string; prefix: string }> {
  return call('/api/keys', { method: 'POST', body: JSON.stringify({}) });
}

export function revokeKey(id: string): Promise<{ ok: true }> {
  return call(`/api/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Store a validation report and get a shareable id for /report?id=…
 * Meters 'share'. Payload is the JSON the report page renders — keep it
 * self-contained (violations, filename, timestamp, verdict).
 */
export function shareReport(payload: unknown): Promise<{ id: string; url: string }> {
  return call('/api/features/share', { method: 'POST', body: JSON.stringify({ payload }) });
}

export function getReport(id: string): Promise<{ payload: unknown; createdAt: number }> {
  return call(`/api/reports/${encodeURIComponent(id)}`);
}

/**
 * Ask permission to run one future-ruleset check. The computation itself is
 * client-side (the library is free); this call is the account/quota gate.
 */
export function regressCredit(): Promise<{ ok: true; remaining: number }> {
  return call('/api/features/regress', { method: 'POST', body: JSON.stringify({}) });
}

/** Records the request and emails Harvey; the manual path, kept as a fallback. */
/**
 * The manual upgrade path: records the request and emails the operator.
 *
 * Returns `payUrl` when PayPal is configured, so the account page can offer
 * payment immediately rather than making someone wait for an email. Paying
 * does not activate the plan on its own — a human still confirms the money
 * arrived — so the UI must not imply otherwise.
 */
export function requestUpgrade(
  plan: Exclude<PlanId, 'free'>,
): Promise<{ ok: true; payUrl?: string }> {
  return call('/api/upgrade', { method: 'POST', body: JSON.stringify({ plan }) });
}

/**
 * Withdraw a pending manual upgrade request — the escape hatch for requests
 * made before self-serve billing existed, which would otherwise pin the
 * account page on "we will email you" forever.
 */
export function cancelUpgradeRequest(): Promise<{ ok: true }> {
  return call('/api/upgrade/cancel', { method: 'POST', body: JSON.stringify({}) });
}

/**
 * Start Stripe Checkout for an existing signed-in account and get the hosted
 * URL to send the browser to.
 *
 * The response is only a redirect target — it grants nothing. The plan changes
 * when Stripe's signed webhook says the payment settled, never because the
 * browser came back from a success URL, which anyone could visit directly.
 */
export function startCheckout(plan: Exclude<PlanId, 'free'>): Promise<{ url: string }> {
  return call('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
}

/** Stripe's hosted portal: card changes, invoices, and self-serve cancellation. */
export function billingPortal(): Promise<{ url: string }> {
  return call('/api/billing/portal', { method: 'POST', body: JSON.stringify({}) });
}

/**
 * Start a recurring PayPal subscription and get the approval URL to send the
 * browser to.
 *
 * Like Stripe Checkout, the returned URL grants nothing on its own. The plan
 * changes when PayPal's verified webhook says the subscription activated —
 * never because the browser came back from the return URL, which anyone could
 * visit directly. Expect a short gap between approval and activation.
 */
export function startPaypalSubscription(plan: Exclude<PlanId, 'free'>): Promise<{ url: string }> {
  return call('/api/billing/paypal/subscribe', { method: 'POST', body: JSON.stringify({ plan }) });
}

/**
 * Cancel the account's PayPal subscription.
 *
 * PayPal has no hosted billing portal, so this is the self-serve exit — it has
 * to live in our own UI rather than being a link into PayPal's account pages.
 */
export function cancelPaypalSubscription(): Promise<{ ok: true }> {
  return call('/api/billing/paypal/cancel', { method: 'POST', body: JSON.stringify({}) });
}

// ------------------------------------------------------- saved invoices
// The account copy of "My invoices". Opt-in from /my-invoices; the payload is
// the builder draft as a JSON string, stored and returned verbatim.

export interface AccountInvoiceSummary {
  id: string;
  number: string;
  customer: string;
  total: string;
  currency: string;
  market: string;
  status: string;
  updatedAt: number;
}

export function listAccountInvoices(): Promise<{ invoices: AccountInvoiceSummary[] }> {
  return call('/api/invoices');
}

export function getAccountInvoice(
  id: string,
): Promise<{ invoice: { id: string; payload: string; status: string; updatedAt: number } }> {
  return call(`/api/invoices/${encodeURIComponent(id)}`);
}

export function saveAccountInvoice(
  id: string,
  body: {
    payload: string;
    number: string;
    customer: string;
    total: string;
    currency: string;
    market: string;
    status: string;
  },
): Promise<{ ok: true; id: string }> {
  return call(`/api/invoices/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteAccountInvoice(id: string): Promise<{ ok: true }> {
  return call(`/api/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** GDPR Art. 20 — everything held about the account, as JSON. */
export function exportAccount(): Promise<Record<string, unknown>> {
  return call('/api/account/export');
}

/**
 * GDPR Art. 17 — irreversible erasure. `confirm` must equal the account email;
 * the server re-checks, so this is not merely a UI guard.
 */
export function deleteAccount(confirm: string): Promise<{ ok: true; deleted: true }> {
  return call('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm }) });
}

/** Whether the AI-explanation feature is switched on server-side at all. */
export function aiStatus(): Promise<{ enabled: boolean }> {
  return call('/api/ai/status');
}

/**
 * Ask the shared "credit jar" for one AI explanation. Metered per user
 * ('quota'), capped globally ('pool_empty'), off entirely ('disabled').
 */
export function aiExplain(violations: unknown[]): Promise<{ explanation: string }> {
  return call('/api/ai/explain', { method: 'POST', body: JSON.stringify({ violations }) });
}

export interface AiDraftLine {
  description: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
}

/**
 * Turn a plain-English description into line items. Same credit jar as the
 * explainer. Deliberately returns *only* commercial content — the server never
 * emits a tax rate, a VAT id, an address or a date, so there is nothing here
 * that could quietly become a compliance claim.
 */
export function aiDraft(
  description: string,
  currency: string,
): Promise<{ lines: AiDraftLine[]; note: string }> {
  return call('/api/ai/draft', {
    method: 'POST',
    body: JSON.stringify({ description, currency }),
  });
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * One turn of the Stampbench assistant. Paid plans only — the worker refuses
 * free-plan sessions with code 'plan' (402), which the widget renders as its
 * locked state rather than an error. Same credit jar as explain/draft.
 */
export function aiChat(messages: ChatTurn[]): Promise<{ reply: string }> {
  return call('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) });
}

// ------------------------------------------------------- payment hook
// Auto-invoicing: one secret inbound webhook URL per account. The URL is
// returned exactly once on creation — it is stored hashed, like an API key.

export function paymentHookStatus(): Promise<{ configured: boolean }> {
  return call('/api/account/payment-hook');
}

/** Creates or rotates the hook; the previous URL stops working immediately. */
export function createPaymentHook(): Promise<{ url: string }> {
  return call('/api/account/payment-hook', { method: 'POST', body: JSON.stringify({}) });
}

export function deletePaymentHook(): Promise<{ ok: true }> {
  return call('/api/account/payment-hook', { method: 'DELETE' });
}

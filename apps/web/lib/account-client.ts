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

export function register(email: string, password: string): Promise<Me> {
  return call('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
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

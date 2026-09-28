/**
 * Stampbench account + hosted API worker.
 *
 * Deployed as Cloudflare Pages "Advanced mode": this file is bundled to
 * out/_worker.js, so it fronts the whole site. It answers /api/* itself and
 * hands every other request to the static assets (env.ASSETS).
 *
 * Design constraints, in order:
 *  1. The playground's local features (validate/generate/fix) never touch
 *     this worker — "unlimited local validation, free forever" stays true.
 *  2. Metering is enforced here, atomically in D1 — the UI's counters are
 *     advisory, this is the wall.
 *  3. No Stripe. A paid-plan request records a row and emails Harvey via the
 *     MAILER service binding; provisioning is a manual admin call. Self-serve
 *     billing can replace that without touching the schema.
 */

import {
  generateUblInvoice,
  fixXml,
  validateXml,
  withComputedTotals,
  withProfileDefaults,
  type Invoice,
  type Profile,
} from '@stampbench/core';
import Anthropic from '@anthropic-ai/sdk';
import {
  AI_GLOBAL_MONTHLY_CAP,
  FEATURE_LIMITS,
  PLANS,
  backupLimit,
  currentPeriodKey,
  featureLimit,
  planFor,
  type FeatureId,
  type PlanId,
} from '../../../apps/web/lib/plans';
import { paypalLink } from './paypal';
import {
  approvalUrl,
  isSubscriptionEvent,
  paypalPlanIdFor,
  paypalRequest,
  paypalSubscriptionEntitles,
  paypalWebhookVerified,
  planFromPaypalPlanId,
  readSignatureHeaders,
  revokeApplies,
  subscriptionIdFromEvent,
  type PaypalCreds,
  type PaypalJson,
  type PaypalPlanIds,
} from './paypal-subscriptions';
import {
  planFromSubscription,
  stripeSignatureValid,
  subscriptionEntitles,
} from './stripe';
import { checkUsersSchema, schemaFailureMessage } from './schema';
import {
  autoInvoiceId,
  buildAutoDraft,
  decideHookAction,
  parsePaymentEvent,
  type InvoiceCandidate,
} from './payment-hook';
import { chatSystemPrompt, sanitizeChatTurns } from './assistant';
import { analyticsDay, countablePath } from './analytics';
import {
  clearSessionCookie,
  clearSessionMarkerCookie,
  hashPassword,
  readCookie,
  sessionCookie,
  sessionMarkerCookie,
  sha256Hex,
  signSession,
  timingSafeEqual,
  verifyPassword,
  verifySession,
  DUMMY_CREDENTIAL,
  SESSION_COOKIE,
  type Session,
} from './auth';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MAILER?: Fetcher;
  JWT_SECRET: string;
  ADMIN_SECRET: string;
  /**
   * New paid checkouts stay off unless this is explicitly set to "true".
   * Existing billing webhooks and cancellation routes remain available so a
   * paused launch can still process or end an existing subscription safely.
   */
  BILLING_LIVE?: string;
  /** Unset = AI explanations disabled site-wide; the UI hides the button. */
  ANTHROPIC_API_KEY?: string;
  /** Override the explanation model; defaults to Haiku per the cost budget. */
  AI_MODEL?: string;
  /** Unset = self-serve billing disabled; the UI falls back to Request-upgrade. */
  STRIPE_SECRET_KEY?: string;
  /** Required whenever STRIPE_SECRET_KEY is set — unsigned webhooks are refused. */
  STRIPE_WEBHOOK_SECRET?: string;
  /**
   * PayPal, the manual path's payment step.
   *
   * Set either a per-plan payment link (PAYPAL_LINK_STARTER / _PRO / _SCALE —
   * a PayPal payment link or subscription link, which is what you want if the
   * amount and cadence should be fixed for the buyer), or PAYPAL_ME with a
   * PayPal.me handle, in which case the amount is appended per plan. Per-plan
   * links win where both are present.
   *
   * These are public URLs, not secrets — they are handed to the browser on
   * purpose so someone can pay the moment they ask to upgrade instead of
   * waiting for an email. Unset = the pre-PayPal behaviour, unchanged.
   */
  PAYPAL_ME?: string;
  PAYPAL_LINK_STARTER?: string;
  PAYPAL_LINK_PRO?: string;
  PAYPAL_LINK_SCALE?: string;
  /**
   * PayPal Subscriptions — the self-serve recurring path.
   *
   * Unlike the link above, these ARE secrets. Set all of CLIENT_ID, SECRET,
   * WEBHOOK_ID and at least one PLAN id and self-serve subscriptions switch on;
   * leave any of them unset and the site falls back to the link, then to the
   * email loop, without shipping a button that 503s.
   *
   * Everything is created by `scripts/paypal-setup.mjs`, which prints these
   * values. Sandbox and live are entirely separate universes — different
   * credentials, different plan ids, different webhook id — so PAYPAL_ENV must
   * match the credentials or every call fails in a confusing way.
   */
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_SECRET?: string;
  /** Required whenever the credentials are set — unverified webhooks are refused. */
  PAYPAL_WEBHOOK_ID?: string;
  /** 'sandbox' to point at PayPal's test environment; anything else is live. */
  PAYPAL_ENV?: string;
  PAYPAL_PLAN_STARTER?: string;
  PAYPAL_PLAN_PRO?: string;
  PAYPAL_PLAN_SCALE?: string;
}

/** The public PayPal link for a plan, or null when PayPal is not configured. */
function paypalLinkFor(env: Env, plan: PlanId): string | null {
  if (!billingLaunchEnabled(env)) return null;
  return paypalLink(
    {
      me: env.PAYPAL_ME,
      starter: env.PAYPAL_LINK_STARTER,
      pro: env.PAYPAL_LINK_PRO,
      scale: env.PAYPAL_LINK_SCALE,
    },
    plan,
  );
}

/** True when any PayPal route is configured, for the UI's copy decisions. */
function paypalConfigured(env: Env): boolean {
  return billingLaunchEnabled(env) && Boolean(env.PAYPAL_ME || env.PAYPAL_LINK_STARTER || env.PAYPAL_LINK_PRO || env.PAYPAL_LINK_SCALE);
}

/** One deliberate production switch controls whether visitors can start payments. */
function billingLaunchEnabled(env: Env): boolean {
  return env.BILLING_LIVE === 'true';
}

/** API credentials, or null when PayPal Subscriptions is not configured. */
function paypalCreds(env: Env): PaypalCreds | null {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return null;
  return {
    clientId: env.PAYPAL_CLIENT_ID,
    secret: env.PAYPAL_SECRET,
    env: env.PAYPAL_ENV === 'sandbox' ? 'sandbox' : 'live',
  };
}

function paypalPlanIds(env: Env): PaypalPlanIds {
  return {
    starter: env.PAYPAL_PLAN_STARTER,
    pro: env.PAYPAL_PLAN_PRO,
    scale: env.PAYPAL_PLAN_SCALE,
  };
}

/**
 * True when the whole self-serve subscription path is usable.
 *
 * The webhook id is part of the condition on purpose. Without it no delivery
 * can be verified, so subscriptions would be created that could never activate
 * an account — the customer pays, nothing happens, and the first anyone knows
 * is a support email. Refusing to offer the button is the better failure.
 */
function paypalSubscriptionsEnabled(env: Env): boolean {
  if (!billingLaunchEnabled(env)) return false;
  if (!paypalCreds(env) || !env.PAYPAL_WEBHOOK_ID) return false;
  const plans = paypalPlanIds(env);
  return Boolean(plans.starter || plans.pro || plans.scale);
}

const MAX_BODY = 1_500_000; // ~1.5 MB — the largest official test invoice is far smaller
const NEUTRAL_AUTH_ERROR = 'Email or password is incorrect.';

/**
 * Refuse any billing path when the D1 schema this worker was built against is
 * missing columns the code will silently corrupt via `SELECT *`. On the
 * 2026-08-17 near-miss the migration for `paypal_subscription_id` had not run;
 * a real buyer would have been charged and stranded on Free forever. Failing
 * loud here means the very first request after a bad deploy makes the gap
 * obvious to the operator, instead of surfacing when money moves.
 */
async function requireBillingSchema(env: Env): Promise<Response | null> {
  const check = await checkUsersSchema(env.DB);
  if (check.ok) return null;
  const message = schemaFailureMessage(check);
  console.error('billing refused: schema drift', message);
  return fail(503, 'schema_drift', message);
}

type Json = Record<string, unknown>;

function json(data: Json, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function fail(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  return json({ error: { code, message } }, status, headers);
}

/**
 * Same-origin guard for cookie-authenticated mutations.
 *
 * The check is that the Origin matches the origin the request actually arrived
 * at. That is self-configuring — it holds on stampbench.com, on any
 * *.pages.dev preview, and on localhost during development — without keeping a
 * standing allowance for hostnames that only exist on a developer's machine.
 * A blanket `http://localhost:*` rule shipped to production would let any page
 * a victim happens to be running locally issue authenticated writes.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  if (origin === new URL(request.url).origin) return true;
  // The apex is what users type; requests can still land on the www alias.
  return origin === 'https://stampbench.com' || origin === 'https://www.stampbench.com';
}

/** Best-effort client identity for abuse counters. */
function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/**
 * Fixed-window abuse counter. Returns true while the action is still allowed.
 *
 * The guarded UPSERT is the enforcement and it is atomic, so racing requests
 * cannot both take the last unit. Windows are aligned to `windowMs` rather
 * than sliding, which is coarser than a token bucket but needs one round trip
 * and no background expiry.
 *
 * Fails **open** on a database error: a D1 blip must not lock every customer
 * out of signing in. The trade is deliberate — availability over strictness on
 * a control that exists to slow bulk abuse, not to gate authorisation.
 */
async function rateLimit(
  env: Env,
  action: string,
  identity: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - (now % windowMs);
  try {
    const row = await env.DB.prepare(
      `INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < ? THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < ? THEN ? ELSE rate_limits.window_start END
       RETURNING count`,
    )
      .bind(`${action}:${identity}`, windowStart, windowStart, windowStart, windowStart)
      .first<{ count: number }>();
    return (row?.count ?? 1) <= limit;
  } catch (e) {
    console.error('rate limit check failed', action, e);
    return true;
  }
}

const TOO_MANY = (retryAfterSeconds: number) =>
  fail(429, 'rate_limited', 'Too many attempts — wait a minute and try again.', {
    'Retry-After': String(retryAfterSeconds),
  });

async function readJson(request: Request): Promise<Json | null> {
  const len = Number(request.headers.get('Content-Length') ?? '0');
  if (len > MAX_BODY) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    return JSON.parse(text) as Json;
  } catch {
    return null;
  }
}

interface UserRow {
  id: string;
  email: string;
  pw_hash: string;
  pw_salt: string;
  plan: string;
  created_at: number;
  /** Null until the account first reaches Stripe Checkout. */
  stripe_customer_id?: string | null;
  /** Set only while a subscription is actually entitling the account. */
  stripe_subscription_id?: string | null;
  /**
   * The account's PayPal subscription (`I-…`). Set when one is created, and
   * kept while it entitles the account so cancellation has something to act
   * on; cleared when the subscription stops entitling.
   */
  paypal_subscription_id?: string | null;
  /**
   * SHA-256 hash of the inbound payment-webhook token (auto-invoicing), or
   * null when none is configured. Requires migration 005 — without it the
   * configure endpoint fails loudly on the missing column, which is the
   * intended signal rather than a silent undefined.
   */
  payment_hook_hash?: string | null;
}

async function sessionUser(request: Request, env: Env): Promise<UserRow | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await verifySession(token, env.JWT_SECRET);
  if (!session) return null;
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.sub).first<UserRow>();
}

/**
 * Spend one unit of a metered feature. Atomic: the guarded UPDATE is the
 * enforcement, so two racing requests cannot both take the last unit.
 * Returns the new count, or null when the quota is exhausted.
 */
async function meter(env: Env, userId: string, plan: string, feature: FeatureId): Promise<number | null> {
  const limit = featureLimit(plan, feature);
  const period = currentPeriodKey();
  await env.DB.prepare(
    'INSERT INTO usage (user_id, feature, period, count) VALUES (?, ?, ?, 0) ON CONFLICT DO NOTHING',
  )
    .bind(userId, feature, period)
    .run();
  const row = await env.DB.prepare(
    'UPDATE usage SET count = count + 1 WHERE user_id = ? AND feature = ? AND period = ? AND (? < 0 OR count < ?) RETURNING count',
  )
    .bind(userId, feature, period, limit, limit)
    .first<{ count: number }>();
  return row?.count ?? null;
}

async function usageSummary(env: Env, user: UserRow): Promise<Record<FeatureId, { used: number; limit: number }>> {
  const period = currentPeriodKey();
  const rows = await env.DB.prepare('SELECT feature, count FROM usage WHERE user_id = ? AND period = ?')
    .bind(user.id, period)
    .all<{ feature: string; count: number }>();
  const used: Record<string, number> = {};
  for (const r of rows.results ?? []) used[r.feature] = r.count;
  const out = {} as Record<FeatureId, { used: number; limit: number }>;
  for (const f of Object.keys(FEATURE_LIMITS.free) as FeatureId[]) {
    out[f] = { used: used[f] ?? 0, limit: featureLimit(user.plan, f) };
  }
  return out;
}

async function meResponse(env: Env, user: UserRow, setCookies?: string[]): Promise<Response> {
  const pending = await env.DB.prepare(
    "SELECT plan FROM upgrade_requests WHERE user_id = ? AND status = 'new' ORDER BY created_at DESC LIMIT 1",
  )
    .bind(user.id)
    .first<{ plan: string }>();
  const res = json({
    email: user.email,
    plan: planFor(user.plan).id,
    createdAt: user.created_at,
    usage: await usageSummary(env, user),
    pendingUpgrade: (pending?.plan as PlanId | undefined) ?? null,
    // Drives the account page: a card-paying customer gets "Manage billing"
    // (Stripe's portal), a PayPal subscriber gets "Cancel subscription", and
    // everyone else gets the upgrade options.
    billing: {
      enabled: !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      subscribed: !!user.stripe_subscription_id,
      hasCustomer: !!user.stripe_customer_id,
      paypalSubscriptions: paypalSubscriptionsEnabled(env),
      paypalSubscribed: !!user.paypal_subscription_id,
    },
  });
  for (const cookie of setCookies ?? []) res.headers.append('Set-Cookie', cookie);
  return res;
}

// ---------------------------------------------------------------- auth

async function handleRegister(request: Request, env: Env): Promise<Response> {
  // Signup is the cheapest way to abuse this service: every free account
  // carries its own quota, so unrestricted registration lets one person mint
  // enough accounts to drain the shared AI pool that the global cap protects
  // Harvey's bill with — the bill stays bounded, the service does not.
  if (!(await rateLimit(env, 'register', clientIp(request), 5, 60 * 60_000))) {
    return TOO_MANY(3600);
  }
  const body = await readJson(request);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const termsAccepted = body?.termsAccepted === true;
  const termsVersion = String(body?.termsVersion ?? '').slice(0, 32);
  if (!termsAccepted) return fail(400, 'terms_required', 'Agree to the Terms and Privacy Policy to create an account.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'invalid_email', 'Enter a valid email address.');
  if (email.length > 254) return fail(400, 'invalid_email', 'Enter a valid email address.');
  if (password.length < 10) return fail(400, 'weak_password', 'Password must be at least 10 characters.');
  // PBKDF2 cost is paid by this worker, so an unbounded password is a CPU
  // amplification primitive. The ceiling is far above any real passphrase.
  if (password.length > 512) return fail(400, 'weak_password', 'Password must be under 512 characters.');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return fail(409, 'email_taken', 'An account with this email already exists — sign in instead.');

  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO users (id, email, pw_hash, pw_salt, plan, created_at, terms_accepted_at, terms_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, email, hash, salt, 'free', now, now, termsVersion || '2026-09-28')
    .run();
  const user: UserRow = { id, email, pw_hash: hash, pw_salt: salt, plan: 'free', created_at: now };
  return meResponse(env, user, [
    sessionCookie(await signSession(id, email, env.JWT_SECRET)),
    sessionMarkerCookie(),
  ]);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  // Two independent limits. Per-IP stops one host spraying many accounts;
  // per-email stops a distributed attempt against one account. Both are needed
  // — either alone leaves the other attack unbounded. Each attempt also costs
  // this worker 100k PBKDF2 iterations, so throttling is a cost control as
  // much as an account-takeover control.
  const ip = clientIp(request);
  const withinIpLimit = await rateLimit(env, 'login-ip', ip, 20, 10 * 60_000);
  const withinEmailLimit = email
    ? await rateLimit(env, 'login-email', await sha256Hex(email), 10, 10 * 60_000)
    : true;
  if (!withinIpLimit || !withinEmailLimit) return TOO_MANY(600);

  if (password.length > 512) return fail(401, 'bad_credentials', NEUTRAL_AUTH_ERROR);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  // Hash even when the account does not exist. The message was already
  // neutral, but the timing was not: returning early on an unknown email made
  // response latency a reliable oracle for "is this address a customer?".
  const ok = user
    ? await verifyPassword(password, user.pw_hash, user.pw_salt)
    : (await verifyPassword(password, DUMMY_CREDENTIAL.hash, DUMMY_CREDENTIAL.salt), false);
  if (!user || !ok) return fail(401, 'bad_credentials', NEUTRAL_AUTH_ERROR);
  return meResponse(env, user, [
    sessionCookie(await signSession(user.id, user.email, env.JWT_SECRET)),
    sessionMarkerCookie(),
  ]);
}

// ---------------------------------------------------------------- API keys

function newApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return 'sb_live_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function handleCreateKey(env: Env, user: UserRow): Promise<Response> {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ?')
    .bind(user.id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= 5) return fail(400, 'too_many_keys', 'Limit of 5 API keys — revoke one first.');
  const key = newApiKey();
  const id = crypto.randomUUID();
  const prefix = key.slice(0, 16) + '…';
  await env.DB.prepare(
    'INSERT INTO api_keys (id, user_id, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, user.id, await sha256Hex(key), prefix, Date.now())
    .run();
  return json({ key, id, prefix });
}

async function apiKeyUser(request: Request, env: Env): Promise<UserRow | null> {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer sb_live_')) return null;
  const keyHash = await sha256Hex(header.slice('Bearer '.length).trim());
  const row = await env.DB.prepare(
    'SELECT u.*, k.id AS key_id FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = ?',
  )
    .bind(keyHash)
    .first<UserRow & { key_id: string }>();
  if (row) {
    await env.DB.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?').bind(Date.now(), row.key_id).run();
  }
  return row;
}

// ---------------------------------------------------------------- hosted API

async function handleHostedApi(request: Request, env: Env, op: 'validate' | 'generate' | 'fix'): Promise<Response> {
  const user = await apiKeyUser(request, env);
  if (!user) {
    return fail(401, 'unauthenticated', 'Pass an API key: Authorization: Bearer sb_live_… (create one at stampbench.com/account).');
  }
  const spent = await meter(env, user.id, user.plan, 'api');
  if (spent === null) {
    return fail(402, 'quota', `Monthly quota reached (${featureLimit(user.plan, 'api')} calls on the ${planFor(user.plan).name} plan). Upgrade at stampbench.com/account.`);
  }
  const body = await readJson(request);
  if (!body) return fail(400, 'bad_request', 'Body must be JSON under 1.5 MB.');

  // The profile has always been documented and was never read: every call ran
  // the German CIUS and every generated document claimed the XRechnung
  // customization id, whatever the caller asked for. It defaults to
  // 'xrechnung' so existing integrations are unaffected, and an unrecognised
  // value is rejected rather than silently falling back — a caller who
  // mistypes it should not receive a verdict from a different ruleset.
  const requested = body.profile ?? new URL(request.url).searchParams.get('profile') ?? undefined;
  if (requested !== undefined && requested !== 'xrechnung' && requested !== 'en16931') {
    return fail(400, 'bad_request', 'profile must be "xrechnung" or "en16931".');
  }
  const profile: Profile = (requested as Profile | undefined) ?? 'xrechnung';

  try {
    if (op === 'validate') {
      const xml = String(body.xml ?? '');
      if (!xml.trim()) return fail(400, 'bad_request', 'Provide { "xml": "…" }.');
      return json({ result: validateXml(xml, { profile }) as unknown as Json });
    }
    if (op === 'fix') {
      const xml = String(body.xml ?? '');
      if (!xml.trim()) return fail(400, 'bad_request', 'Provide { "xml": "…" }.');
      return json({ result: fixXml(xml, { profile }) as unknown as Json });
    }
    const invoice = body.invoice;
    if (!invoice || typeof invoice !== 'object') return fail(400, 'bad_request', 'Provide { "invoice": { … } }.');
    const full = withComputedTotals(withProfileDefaults(invoice as Invoice, { profile }));
    return json({ xml: generateUblInvoice(full, { profile }), profile });
  } catch (e) {
    return fail(422, 'unprocessable', (e as Error).message);
  }
}

// ---------------------------------------------------------------- features

async function handleShare(request: Request, env: Env, user: UserRow, origin: string): Promise<Response> {
  const body = await readJson(request);
  if (!body?.payload) return fail(400, 'bad_request', 'Provide { "payload": … }.');
  const spent = await meter(env, user.id, user.plan, 'share');
  if (spent === null) {
    return fail(402, 'quota', `Report-sharing quota reached for this month (${featureLimit(user.plan, 'share')} on ${planFor(user.plan).name}).`);
  }
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await env.DB.prepare('INSERT INTO reports (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, user.id, JSON.stringify(body.payload), Date.now())
    .run();
  return json({ id, url: `${origin}/report?id=${id}` });
}

/**
 * Account-saved invoices — the browser's "My invoices" list, backed up.
 *
 * Strictly opt-in, because the site promises invoices stay in the browser
 * unless you choose otherwise. The payload is the builder's draft JSON,
 * stored verbatim and returned verbatim: this worker never parses, edits or
 * even understands an invoice — it keeps what the browser chose to save, for
 * that account only. Summary columns exist purely so the list can render
 * without shipping every payload. Logos are stripped client-side before
 * upload, which keeps rows small.
 *
 * These same rows are where auto-created invoices (from payments or
 * forwarded emails) will land later, with a status that says who made them.
 *
 * The archive is rolling, sized by plan (BACKUP_LIMITS): saving never fails
 * over the limit — the oldest entries fall off instead, and the UI says so.
 */
const MAX_INVOICE_PAYLOAD = 400_000;

/** Clip a client-sent summary field: display data, never trusted for length. */
function summaryField(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

async function handleSaveInvoice(request: Request, env: Env, user: UserRow, id: string): Promise<Response> {
  if (!(await rateLimit(env, 'invoice-save', user.id, 90, 60_000))) return TOO_MANY(60);
  const body = await readJson(request);
  const payload = body?.payload;
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > MAX_INVOICE_PAYLOAD) {
    return fail(400, 'bad_request', 'Provide { "payload": "<draft JSON>" } under 400 kB.');
  }
  try {
    JSON.parse(payload);
  } catch {
    return fail(400, 'bad_request', 'The payload is not valid JSON.');
  }

  // Ids are client-generated so the browser list and the account stay in step,
  // which means an id must never silently adopt a row that is not yours.
  const existing = await env.DB.prepare('SELECT user_id FROM invoices WHERE id = ?')
    .bind(id)
    .first<{ user_id: string }>();
  if (existing && existing.user_id !== user.id) {
    return fail(403, 'forbidden', 'That invoice id belongs to another account.');
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO invoices (id, user_id, number, customer, total, currency, market, status, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       number = excluded.number, customer = excluded.customer, total = excluded.total,
       currency = excluded.currency, market = excluded.market,
       -- An auto-created row (id 'wh…') is a record of a received payment.
       -- A stale browser push that has not yet learned it was paid must not
       -- silently revert it to 'created'; keep the server's stronger status.
       status = CASE WHEN invoices.id LIKE 'wh%' AND excluded.status = 'created'
                     THEN invoices.status ELSE excluded.status END,
       payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      user.id,
      summaryField(body?.number, 80),
      summaryField(body?.customer, 160),
      summaryField(body?.total, 40),
      summaryField(body?.currency, 8),
      summaryField(body?.market, 16),
      summaryField(body?.status, 16) || 'created',
      payload,
      now,
      now,
    )
    .run();

  // Rolling archive, scoped to browser-saved rows ONLY (not the 'wh…' auto
  // rows, which are trimmed on their own window in handlePaymentHook). Keeping
  // the two buckets separate is what stops webhook invoices and user-saved
  // invoices from evicting each other. The browser's own list is untouched.
  await env.DB.prepare(
    `DELETE FROM invoices WHERE user_id = ? AND id NOT LIKE 'wh%' AND id NOT IN (
       SELECT id FROM invoices WHERE user_id = ? AND id NOT LIKE 'wh%' ORDER BY updated_at DESC LIMIT ?
     )`,
  )
    .bind(user.id, user.id, backupLimit(user.plan))
    .run();

  return json({ ok: true, id, keeps: backupLimit(user.plan) });
}

async function handleUpgrade(request: Request, env: Env, user: UserRow): Promise<Response> {
  const body = await readJson(request);
  const plan = String(body?.plan ?? '');
  if (!(plan in PLANS) || plan === 'free') return fail(400, 'bad_request', 'Unknown plan.');

  // Throttle. This was the one mutating authenticated endpoint with no rate
  // limit, and it both writes a row and emails the operator — so a logged-in
  // account driving its own session with curl (the same-origin gate only
  // stops cross-site *browsers*) could mail-flood the inbox and inflate D1.
  // Every other write here is already throttled; five requests an hour is
  // plenty for a human choosing a plan, and it bounds both the email volume
  // and the row growth. (No dedup here on purpose — that needs a partial
  // unique index, i.e. a migration; the rate limit already closes the issue.)
  if (!(await rateLimit(env, 'upgrade', user.id, 5, 60 * 60_000))) return TOO_MANY(3600);

  await env.DB.prepare(
    'INSERT INTO upgrade_requests (id, user_id, email, plan, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), user.id, user.email, plan, Date.now())
    .run();

  // Best-effort notification: the request row above is the durable record.
  // `mailed`/`mailError` in the response exist for observability — the static
  // site has no server logs a human ever reads.
  const payUrl = paypalLinkFor(env, plan as PlanId);

  let mailed = false;
  let mailError: string | null = env.MAILER ? null : 'MAILER binding missing';
  if (env.MAILER) {
    const p = PLANS[plan as PlanId];
    const activate = `$h=@{'X-Admin-Secret'='<ADMIN_SECRET>';'Content-Type'='application/json'}; Invoke-RestMethod -Method Post -Uri https://stampbench.com/api/admin/set-plan -Headers $h -Body '{"email":"${user.email}","plan":"${plan}"}'`;
    const activateSh = `curl -X POST https://stampbench.com/api/admin/set-plan -H 'X-Admin-Secret: <ADMIN_SECRET>' -H 'Content-Type: application/json' -d '{"email":"${user.email}","plan":"${plan}"}'`;
    try {
      const res = await env.MAILER.fetch('https://mailer.internal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Stampbench upgrade request: ${user.email} → ${p.name} (£${p.priceGbp}/mo)`,
          text:
            `${user.email} asked for the ${p.name} plan (£${p.priceGbp}/month).\n\n` +
            (payUrl
              ? `They were shown this PayPal link and may have paid already — CHECK PAYPAL FIRST:\n${payUrl}\n\n` +
                `Look for £${p.priceGbp} from ${user.email} (or a different PayPal address — the payer's email need not match).\n\n`
              : `PayPal is not configured, so they were told you would email them to arrange payment.\n\n`) +
            `Once the money is in, activate with either:\n\nPowerShell:\n${activate}\n\nbash:\n${activateSh}\n\n` +
            `(Replace <ADMIN_SECRET>. Requested ${new Date().toISOString()}.)`,
        }),
      });
      mailed = res.ok;
      if (!res.ok) mailError = `mailer ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) {
      mailError = (e as Error).message;
    }
    if (mailError) console.error('upgrade mail failed', mailError);
  }
  return json({ ok: true, mailed, ...(payUrl ? { payUrl } : {}), ...(mailError ? { mailError } : {}) });
}

// ---------------------------------------------------------------- AI explanations

/**
 * The "credit jar": one shared Anthropic key, per-user monthly quotas, and a
 * global monthly cap so total upstream spend is bounded no matter how many
 * users sign up. Both meters are charged before the upstream call and
 * refunded on failure — an Anthropic outage must not eat anyone's quota.
 */
async function unmeter(env: Env, userId: string, feature: FeatureId): Promise<void> {
  await env.DB.prepare(
    'UPDATE usage SET count = count - 1 WHERE user_id = ? AND feature = ? AND period = ? AND count > 0',
  )
    .bind(userId, feature, currentPeriodKey())
    .run();
}

async function meterGlobalAi(env: Env): Promise<boolean> {
  const period = currentPeriodKey();
  await env.DB.prepare(
    'INSERT INTO usage (user_id, feature, period, count) VALUES (?, ?, ?, 0) ON CONFLICT DO NOTHING',
  )
    .bind('__global__', 'ai', period)
    .run();
  const row = await env.DB.prepare(
    'UPDATE usage SET count = count + 1 WHERE user_id = ? AND feature = ? AND period = ? AND count < ? RETURNING count',
  )
    .bind('__global__', 'ai', period, AI_GLOBAL_MONTHLY_CAP)
    .first<{ count: number }>();
  return row !== null;
}

async function handleAiExplain(request: Request, env: Env, user: UserRow): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return fail(503, 'disabled', 'AI explanations are not enabled yet.');
  }
  const body = await readJson(request);
  const violations = Array.isArray(body?.violations) ? body.violations.slice(0, 50) : null;
  if (!violations?.length) return fail(400, 'bad_request', 'Provide { "violations": [...] }.');

  if (!(await meterGlobalAi(env))) {
    return fail(503, 'pool_empty', 'The monthly AI allowance is used up site-wide — back next month.');
  }
  const spent = await meter(env, user.id, user.plan, 'ai');
  if (spent === null) {
    await unmeter(env, '__global__', 'ai');
    return fail(402, 'quota', `AI explanations used up for this month (${featureLimit(user.plan, 'ai')} on ${planFor(user.plan).name}). Upgrade for more.`);
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: env.AI_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 1024,
      system:
        'You explain e-invoice (EN 16931 / XRechnung) validation failures to developers who are not compliance experts. ' +
        'For the violations given, write a short plain-language explanation of what is wrong and what to change, ' +
        'grouped sensibly. Be concrete and honest; never invent field values the data does not contain.',
      messages: [
        {
          role: 'user',
          content: `Validation violations:\n${JSON.stringify(violations, null, 1).slice(0, 20_000)}`,
        },
      ],
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    if (!text) throw new Error('empty completion');
    return json({ explanation: text });
  } catch (e) {
    await unmeter(env, '__global__', 'ai');
    await unmeter(env, user.id, 'ai');
    console.error('ai explain failed', e);
    return fail(502, 'upstream', 'The explanation service had a hiccup — your quota was not charged. Try again.');
  }
}

/**
 * AI assist for the invoice builder: plain English in, line items out.
 *
 * Scoped deliberately narrowly. It may propose descriptions, quantities, unit
 * codes and unit prices — the commercial content the user is describing to it
 * — and nothing else. It is never asked for, and its output is never read for,
 * a VAT identifier, a tax rate, a tax category, an address, a buyer reference
 * or a payment detail. Those are the fields where a plausible invention turns
 * "invalid" into "quietly wrong", and the builder's whole premise is that it
 * would rather fail honestly than guess.
 *
 * Metering, the shared credit jar and the refund-on-failure behaviour are the
 * same as the explainer's — one dormant key switches both on.
 */
async function handleAiDraft(request: Request, env: Env, user: UserRow): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return fail(503, 'disabled', 'AI assist is not enabled yet.');
  }
  const body = await readJson(request);
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 2000) : '';
  const currency = typeof body?.currency === 'string' ? body.currency.slice(0, 3) : 'EUR';
  if (description.length < 3) return fail(400, 'bad_request', 'Provide { "description": "…" }.');

  if (!(await meterGlobalAi(env))) {
    return fail(503, 'pool_empty', 'The monthly AI allowance is used up site-wide — back next month.');
  }
  const spent = await meter(env, user.id, user.plan, 'ai');
  if (spent === null) {
    await unmeter(env, '__global__', 'ai');
    return fail(402, 'quota', `AI assists used up for this month (${featureLimit(user.plan, 'ai')} on ${planFor(user.plan).name}). Upgrade for more.`);
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: env.AI_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 1024,
      system:
        'You turn a plain-English description of work or goods into invoice line items. ' +
        'Reply with JSON only, no prose: {"lines":[{"description":string,"quantity":number,"unitCode":string,"unitPrice":number}],"note":string}. ' +
        'unitCode is a UN/ECE Rec 20 code: C62 (item), HUR (hour), DAY, MON (month), ANN (year), KGM, MTR, E48 (service unit). ' +
        `Amounts are in ${currency}, as plain numbers with no symbol or separators. ` +
        'Only state a quantity or price the description actually gives you; if a price is not stated, use 0 and leave it for the user. ' +
        'Never output tax rates, tax categories, VAT numbers, addresses, dates, invoice numbers or payment details — you are not given them and must not invent them. ' +
        'Keep "note" to one short sentence, or an empty string.',
      messages: [{ role: 'user', content: description }],
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // The model was told to answer in JSON; a fenced block is the usual way it
    // disobeys, so unwrap that before parsing rather than failing the request.
    const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(unfenced) as { lines?: unknown; note?: unknown };
    const lines = (Array.isArray(parsed.lines) ? parsed.lines : [])
      .slice(0, 30)
      .map((raw) => {
        const line = (raw ?? {}) as Record<string, unknown>;
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        return {
          description: String(line.description ?? '').slice(0, 300),
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          unitCode: /^[A-Z0-9]{1,3}$/.test(String(line.unitCode ?? '')) ? String(line.unitCode) : 'C62',
          unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        };
      })
      .filter((line) => line.description.length > 0);

    if (!lines.length) throw new Error('no usable lines');
    return json({ lines, note: typeof parsed.note === 'string' ? parsed.note.slice(0, 300) : '' });
  } catch (e) {
    await unmeter(env, '__global__', 'ai');
    await unmeter(env, user.id, 'ai');
    console.error('ai draft failed', e);
    return fail(502, 'upstream', 'The assist service had a hiccup — your quota was not charged. Try again.');
  }
}

/**
 * The Stampbench assistant — multi-turn chat, paid plans only.
 *
 * The plan gate comes before everything else and is the point: Free keeps its
 * five explain/draft credits, but the assistant is a paid feature, enforced
 * here where it costs money, not just in the widget. Metering and the
 * refund-on-failure behaviour are the explainer's, from the same credit jar.
 */
async function handleAiChat(request: Request, env: Env, user: UserRow): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return fail(503, 'disabled', 'The assistant is not enabled yet.');
  }
  const plan = planFor(user.plan);
  if (plan.id === 'free') {
    return fail(402, 'plan', 'The assistant is part of paid plans — upgrade to use it.');
  }
  const body = await readJson(request);
  const turns = sanitizeChatTurns(body?.messages);
  if (!turns) return fail(400, 'bad_request', 'Provide { "messages": [{ "role", "content" }, …] } ending with a user turn.');

  if (!(await meterGlobalAi(env))) {
    return fail(503, 'pool_empty', 'The monthly AI allowance is used up site-wide — back next month.');
  }
  // meter() can throw on a transient D1 error; if it does, the global unit is
  // already spent and must be refunded, matching the try-block's discipline.
  let spent: number | null;
  try {
    spent = await meter(env, user.id, user.plan, 'ai');
  } catch (e) {
    await unmeter(env, '__global__', 'ai');
    console.error('ai chat meter failed', e);
    return fail(502, 'upstream', 'The assistant had a hiccup — your quota was not charged. Try again.');
  }
  if (spent === null) {
    await unmeter(env, '__global__', 'ai');
    return fail(402, 'quota', `AI credits used up for this month (${featureLimit(user.plan, 'ai')} on ${plan.name}). Upgrade for more.`);
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: env.AI_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 1024,
      system: chatSystemPrompt(plan.name),
      messages: turns,
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    if (!text) throw new Error('empty completion');
    return json({ reply: text });
  } catch (e) {
    await unmeter(env, '__global__', 'ai');
    await unmeter(env, user.id, 'ai');
    console.error('ai chat failed', e);
    return fail(502, 'upstream', 'The assistant had a hiccup — your quota was not charged. Try again.');
  }
}

// ---------------------------------------------------------------- payment hook

/**
 * Manage the account's inbound payment-webhook URL (see payment-hook.ts for
 * what deliveries do). One hook per account; the token is returned exactly
 * once and stored hashed, like an API key. Paid plans only — auto-invoicing
 * is continuity/automation, which is what a plan buys, and a Free account's
 * 10-row rolling archive would silently eat webhook-created rows anyway.
 */
async function handleCreatePaymentHook(env: Env, user: UserRow, origin: string): Promise<Response> {
  if (planFor(user.plan).id === 'free') {
    return fail(402, 'plan', 'Auto-invoicing is part of paid plans — upgrade to switch it on.');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const token = 'sbwh_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('UPDATE users SET payment_hook_hash = ? WHERE id = ?')
    .bind(await sha256Hex(token), user.id)
    .run();
  return json({ url: `${origin}/api/hooks/payment/${token}` });
}

/**
 * One inbound payment delivery. Sits above the origin gate — providers send
 * no Origin header — so the secret token in the path is the whole of the
 * authentication, compared by hash. Responses are 200 even for "ignored"
 * outcomes, because a non-2xx teaches providers to retry forever.
 */
async function handlePaymentHook(request: Request, env: Env, token: string): Promise<Response> {
  const tokenHash = await sha256Hex(token);
  if (!(await rateLimit(env, 'payment-hook', tokenHash.slice(0, 16), 120, 60_000))) return TOO_MANY(60);

  const user = await env.DB.prepare('SELECT * FROM users WHERE payment_hook_hash = ?')
    .bind(tokenHash)
    .first<UserRow>();
  if (!user) return fail(404, 'not_found', 'No such webhook.');
  if (planFor(user.plan).id === 'free') {
    // A downgraded account's hook goes quiet rather than erroring: the
    // provider keeps delivering happily and nothing lands.
    return json({ ok: false, action: 'ignored', reason: 'plan' });
  }

  const body = await readJson(request);
  if (!body) return fail(400, 'bad_request', 'Send a JSON body.');
  const event = parsePaymentEvent(body);
  if (!event) {
    // Unrecognised event types are normal provider chatter, not failures.
    return json({ ok: false, action: 'ignored', reason: 'unrecognised' });
  }

  if (event.invoiceNumber) {
    const rows = await env.DB.prepare(
      'SELECT id, number, status FROM invoices WHERE user_id = ? ORDER BY updated_at DESC',
    )
      .bind(user.id)
      .all<InvoiceCandidate>();
    const decision = decideHookAction(event, rows.results ?? []);
    if (decision.action === 'already_paid') return json({ ok: true, action: 'already_paid', id: decision.id });
    if (decision.action === 'mark_paid') {
      await env.DB.prepare('UPDATE invoices SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .bind('paid', Date.now(), decision.id, user.id)
        .run();
      return json({ ok: true, action: 'marked_paid', id: decision.id });
    }
  }

  // No reference → a random nonce, so two genuinely distinct same-amount
  // payments never collapse to one row (they would silently drop money);
  // with a reference the id is deterministic and retries stay idempotent.
  const id = await autoInvoiceId(user.id, event, crypto.randomUUID());
  const draft = buildAutoDraft(event, new Date(), id);
  const now = Date.now();
  // INSERT OR IGNORE is the idempotency: a redelivered event with a reference
  // computes the same id and bounces off the primary key instead of duplicating.
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO invoices (id, user_id, number, customer, total, currency, market, status, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.id,
      draft.document.number.slice(0, 80),
      draft.buyer.name.slice(0, 160),
      `${event.amount} ${event.currency}`.slice(0, 40),
      event.currency.slice(0, 8),
      draft.market.slice(0, 16),
      'auto',
      JSON.stringify(draft),
      now,
      now,
    )
    .run();
  if (!inserted.meta.changes) return json({ ok: true, action: 'duplicate', id });

  // Rolling archive, scoped to auto rows ONLY (id prefix 'wh', which survives
  // the status round-trip through the browser). A flood of webhook payments —
  // or a leaked hook URL — must never evict a user's own saved invoices, which
  // are trimmed on their own separate window in handleSaveInvoice.
  await env.DB.prepare(
    `DELETE FROM invoices WHERE user_id = ? AND id LIKE 'wh%' AND id NOT IN (
       SELECT id FROM invoices WHERE user_id = ? AND id LIKE 'wh%' ORDER BY updated_at DESC LIMIT ?
     )`,
  )
    .bind(user.id, user.id, backupLimit(user.plan))
    .run();

  return json({ ok: true, action: 'created', id });
}

// ---------------------------------------------------------------- billing

/**
 * Stripe over plain fetch rather than the SDK.
 *
 * The worker is already carrying the Anthropic SDK; a second one costs bundle
 * size for three endpoints and a signature check, and the Node-shaped SDKs are
 * the usual source of `nodejs_compat` surprises on Pages. The REST surface here
 * is form-encoded and stable.
 */
interface StripeResult {
  ok: boolean;
  status: number;
  body: Json;
}

async function stripeRequest(
  env: Env,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  form?: Record<string, string>,
): Promise<StripeResult> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Stripe replays a retried write instead of repeating it. Checkout
      // sessions are cheap to duplicate, but subscription cancellation is not.
      ...(method === 'POST' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    },
    ...(form ? { body: new URLSearchParams(form).toString() } : {}),
  });
  let body: Json = {};
  try {
    body = (await res.json()) as Json;
  } catch {
    /* Stripe always returns JSON; an empty body only happens on a transport fault. */
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Resolve a plan id to its live Stripe price by reading `metadata.plan_id` off
 * the price, rather than pinning price ids in environment variables.
 *
 * The mapping then lives in exactly one place — Stripe — and a price created
 * by hand in the dashboard works as long as it carries the metadata. When a
 * plan has been re-priced and both prices are left active, the newest wins.
 */
async function priceForPlan(env: Env, plan: PlanId): Promise<string | null> {
  const res = await stripeRequest(env, 'GET', '/v1/prices?active=true&type=recurring&limit=100');
  if (!res.ok) {
    console.error('stripe: price lookup failed', res.status, res.body);
    return null;
  }
  const prices = (res.body.data as Array<Json> | undefined) ?? [];
  const matches = prices
    .filter((p) => ((p.metadata as Json | undefined)?.plan_id as string | undefined) === plan)
    .sort((a, b) => Number(b.created ?? 0) - Number(a.created ?? 0));
  return (matches[0]?.id as string | undefined) ?? null;
}

const PLAN_IDS = Object.keys(PLANS);

/**
 * Bring a user's plan into line with a Stripe subscription object.
 *
 * This is the single write path for entitlement, shared by every subscription
 * event, so create / upgrade / downgrade / cancel / payment-failure all settle
 * through the same rules and cannot disagree. It is idempotent: Stripe retries
 * deliveries, and replaying an event just rewrites the same row.
 *
 * Anything other than an active or trialing subscription drops the account to
 * free. That deliberately includes `past_due` — Stripe keeps retrying a failed
 * card for weeks, and serving a paid plan throughout is unpaid service.
 */
async function syncSubscription(env: Env, subscription: Json): Promise<void> {
  const customerId = String(subscription.customer ?? '');
  const subscriptionId = String(subscription.id ?? '');
  const status = String(subscription.status ?? '');
  const userId = (subscription.metadata as Json | undefined)?.user_id as string | undefined;

  const user =
    (userId
      ? await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>()
      : null) ??
    (customerId
      ? await env.DB.prepare('SELECT * FROM users WHERE stripe_customer_id = ?')
          .bind(customerId)
          .first<UserRow>()
      : null);

  if (!user) {
    // Not an error worth failing the webhook over: a subscription can exist in
    // Stripe for an account that was since deleted. Returning 200 stops Stripe
    // retrying something that will never resolve.
    console.error('stripe: no user for subscription', subscriptionId, customerId);
    return;
  }

  const entitled = subscriptionEntitles(status);
  const plan = entitled ? (planFromSubscription(subscription, PLAN_IDS) ?? 'free') : 'free';

  await env.DB.prepare(
    'UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?',
  )
    .bind(plan, customerId || user.stripe_customer_id, entitled ? subscriptionId : null, user.id)
    .run();

  // Close the manual request loop so /account stops showing "pending" once the
  // same upgrade has arrived by card.
  if (plan !== 'free') {
    await env.DB.prepare(
      "UPDATE upgrade_requests SET status = 'done' WHERE user_id = ? AND status = 'new'",
    )
      .bind(user.id)
      .run();
  }
  console.log('stripe: plan synced', user.id, status, plan);
}

/** Reuse this account's Stripe customer, creating one on first checkout. */
async function stripeCustomerFor(env: Env, user: UserRow): Promise<string | null> {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const created = await stripeRequest(env, 'POST', '/v1/customers', {
    email: user.email,
    'metadata[user_id]': user.id,
  });
  if (!created.ok) {
    console.error('stripe: customer create failed', created.status, created.body);
    return null;
  }
  const id = String(created.body.id ?? '');
  await env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind(id, user.id).run();
  return id;
}

/**
 * Start a Checkout session for an already-registered, signed-in account.
 *
 * Upgrade-only by design: the account exists before payment, so the webhook
 * always has a user to attribute the subscription to and there is no
 * "paid but no account" state to reconcile by hand.
 */
async function handleCheckout(request: Request, env: Env, user: UserRow, origin: string): Promise<Response> {
  if (!billingLaunchEnabled(env) || !env.STRIPE_SECRET_KEY) {
    return fail(503, 'billing_disabled', 'Card payment is not switched on yet — use Request upgrade.');
  }
  const schemaGate = await requireBillingSchema(env);
  if (schemaGate) return schemaGate;
  if (!(await rateLimit(env, 'checkout', user.id, 10, 60 * 60_000))) return TOO_MANY(3600);

  const body = await readJson(request);
  const plan = String(body?.plan ?? '');
  if (!(plan in PLANS) || plan === 'free') return fail(400, 'bad_request', 'Unknown plan.');
  if (user.plan === plan) return fail(400, 'already_on_plan', `You are already on ${planFor(plan).name}.`);

  const price = await priceForPlan(env, plan as PlanId);
  if (!price) {
    return fail(503, 'price_missing', 'That plan has no active price configured yet — email hello@stampbench.com.');
  }
  const customer = await stripeCustomerFor(env, user);
  if (!customer) return fail(502, 'billing_upstream', 'Could not reach the payment provider — try again shortly.');

  const session = await stripeRequest(env, 'POST', '/v1/checkout/sessions', {
    mode: 'subscription',
    customer,
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    client_reference_id: user.id,
    'metadata[user_id]': user.id,
    // Carried onto the subscription so every later event can resolve the user
    // even if the customer record is ever detached.
    'subscription_data[metadata][user_id]': user.id,
    allow_promotion_codes: 'true',
    success_url: `${origin}/account?upgraded=1`,
    cancel_url: `${origin}/pricing`,
  });
  if (!session.ok) {
    console.error('stripe: checkout session failed', session.status, session.body);
    return fail(502, 'billing_upstream', 'Could not start checkout — try again shortly.');
  }
  return json({ url: String(session.body.url ?? '') });
}

/**
 * Stripe's hosted billing portal: card changes, invoices, and cancellation.
 *
 * Cancellation belongs here rather than in our own UI — self-serve exit is
 * both a consumer-rights expectation and the difference between billing that
 * runs itself and billing that generates support email.
 */
async function handleBillingPortal(env: Env, user: UserRow, origin: string): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return fail(503, 'billing_disabled', 'Card payment is not switched on yet.');
  const schemaGate = await requireBillingSchema(env);
  if (schemaGate) return schemaGate;
  if (!user.stripe_customer_id) return fail(400, 'no_customer', 'No billing history on this account yet.');
  const portal = await stripeRequest(env, 'POST', '/v1/billing_portal/sessions', {
    customer: user.stripe_customer_id,
    return_url: `${origin}/account`,
  });
  if (!portal.ok) {
    console.error('stripe: portal failed', portal.status, portal.body);
    return fail(502, 'billing_upstream', 'Could not open the billing portal — try again shortly.');
  }
  return json({ url: String(portal.body.url ?? '') });
}

/**
 * The entitlement authority. Everything that grants or removes a paid plan
 * arrives here — never from the browser, which can only ever *start* a
 * checkout and cannot be trusted to report its outcome.
 */
async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return fail(503, 'billing_disabled', 'Billing is not configured.');
  }
  const schemaGate = await requireBillingSchema(env);
  if (schemaGate) return schemaGate;
  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, 'too_large', 'Payload too large.');
  if (!(await stripeSignatureValid(raw, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET))) {
    return fail(400, 'bad_signature', 'Signature verification failed.');
  }

  let event: Json;
  try {
    event = JSON.parse(raw) as Json;
  } catch {
    return fail(400, 'bad_request', 'Body is not JSON.');
  }
  const type = String(event.type ?? '');
  const object = ((event.data as Json | undefined)?.object as Json | undefined) ?? {};

  try {
    if (type === 'checkout.session.completed') {
      const subscriptionId = String(object.subscription ?? '');
      if (subscriptionId) {
        const sub = await stripeRequest(env, 'GET', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
        if (sub.ok) await syncSubscription(env, sub.body);
        else console.error('stripe: subscription fetch failed', sub.status, sub.body);
      }
    } else if (
      type === 'customer.subscription.created' ||
      type === 'customer.subscription.updated' ||
      type === 'customer.subscription.deleted'
    ) {
      await syncSubscription(env, object);
    }
  } catch (e) {
    // 500 asks Stripe to retry, which is right for a transient D1 fault.
    console.error('stripe: webhook handler failed', type, e);
    return fail(500, 'internal', 'Handler failed; please retry.');
  }
  return json({ received: true });
}

// ---------------------------------------------------------------- PayPal Subscriptions

/**
 * Bring a user's plan into line with a PayPal subscription object — the
 * PayPal twin of `syncSubscription`, and the only write path by which PayPal
 * can change an entitlement.
 *
 * Idempotent, because PayPal retries deliveries for up to three days and
 * replaying an event must simply rewrite the same row.
 *
 * Two guards exist here that the Stripe path does not need:
 *
 *  - **Stale-cancellation.** PayPal does not order its deliveries. If someone
 *    resubscribes after cancelling, the old subscription's CANCELLED event can
 *    arrive after the new one activated; applying it would revoke a plan
 *    somebody is paying for. An event about a subscription that is not the
 *    account's current one may never revoke.
 *  - **Cross-provider.** Stripe and PayPal are independent authorities over
 *    the same `plan` column. A PayPal revoke must not drop an account that a
 *    live Stripe subscription is entitling, or cancelling a long-dead PayPal
 *    subscription would silently downgrade a paying card customer.
 */
async function syncPaypalSubscription(env: Env, subscription: PaypalJson): Promise<void> {
  const subscriptionId = String(subscription.id ?? '');
  const status = String(subscription.status ?? '');
  const customId = typeof subscription.custom_id === 'string' ? subscription.custom_id : '';

  const user =
    (customId
      ? await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(customId).first<UserRow>()
      : null) ??
    (subscriptionId
      ? await env.DB.prepare('SELECT * FROM users WHERE paypal_subscription_id = ?')
          .bind(subscriptionId)
          .first<UserRow>()
      : null);

  if (!user) {
    // A subscription can outlive the account it belonged to. Returning without
    // error stops PayPal retrying something that will never resolve.
    console.error('paypal: no user for subscription', subscriptionId, customId);
    return;
  }

  const entitled = paypalSubscriptionEntitles(status);

  if (!entitled && !revokeApplies(user.paypal_subscription_id, subscriptionId)) {
    console.log('paypal: ignoring revoke for a subscription that is not current', subscriptionId, user.id);
    return;
  }

  // An active subscription against a plan id we do not recognise means someone
  // is paying for something this deployment cannot map to a tier — a plan
  // created by hand, or sandbox ids left in a live environment. Granting a
  // guess would be worse than granting nothing, but the subscription is real,
  // so it is still recorded and still cancellable.
  const granted = entitled ? planFromPaypalPlanId(paypalPlanIds(env), subscription.plan_id) : null;
  if (entitled && !granted) {
    console.error('paypal: active subscription with unmapped plan id', subscriptionId, subscription.plan_id);
  }

  const plan =
    granted ??
    // Nothing to grant. Drop to free unless Stripe is separately entitling
    // this account, in which case its subscription remains the authority.
    (user.stripe_subscription_id ? user.plan : 'free');

  await env.DB.prepare('UPDATE users SET plan = ?, paypal_subscription_id = ? WHERE id = ?')
    .bind(plan, entitled ? subscriptionId : null, user.id)
    .run();

  if (granted) {
    // Close the manual request loop so /account stops showing "pending" once
    // the same upgrade has arrived through PayPal.
    await env.DB.prepare("UPDATE upgrade_requests SET status = 'done' WHERE user_id = ? AND status = 'new'")
      .bind(user.id)
      .run();
  }
  console.log('paypal: plan synced', user.id, status, plan);
}

/**
 * Re-read a subscription from PayPal and apply it.
 *
 * Always preferred over trusting the object inside a webhook: deliveries are
 * retried for days and are not ordered, so an event's snapshot may describe a
 * state two changes old, while a GET is the current truth. A subscription
 * PayPal no longer has is treated as cancelled — it certainly is not paying.
 */
async function refreshPaypalSubscription(
  env: Env,
  creds: PaypalCreds,
  subscriptionId: string,
  fallbackUserId?: string,
): Promise<'synced' | 'upstream_error'> {
  const res = await paypalRequest(
    creds,
    'GET',
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  if (res.ok) {
    await syncPaypalSubscription(env, res.body);
    return 'synced';
  }
  if (res.status === 404) {
    await syncPaypalSubscription(env, {
      id: subscriptionId,
      status: 'CANCELLED',
      ...(fallbackUserId ? { custom_id: fallbackUserId } : {}),
    });
    return 'synced';
  }
  console.error('paypal: subscription fetch failed', res.status, res.body);
  return 'upstream_error';
}

/**
 * Start a PayPal subscription for a signed-in account and return the URL to
 * send the browser to for approval.
 *
 * The response is only a redirect target — it grants nothing. `custom_id`
 * carries the user id into PayPal so that every later event can be attributed
 * back to this account, which is the entire reason self-serve activation is
 * possible at all.
 */
async function handlePaypalSubscribe(
  request: Request,
  env: Env,
  user: UserRow,
  origin: string,
): Promise<Response> {
  const creds = paypalCreds(env);
  if (!creds || !paypalSubscriptionsEnabled(env)) {
    return fail(503, 'billing_disabled', 'PayPal subscriptions are not switched on yet — use Request upgrade.');
  }
  const schemaGate = await requireBillingSchema(env);
  if (schemaGate) return schemaGate;
  if (!(await rateLimit(env, 'paypal_subscribe', user.id, 10, 60 * 60_000))) return TOO_MANY(3600);

  const body = await readJson(request);
  const plan = String(body?.plan ?? '');
  if (!(plan in PLANS) || plan === 'free') return fail(400, 'bad_request', 'Unknown plan.');
  if (user.plan === plan) return fail(400, 'already_on_plan', `You are already on ${planFor(plan).name}.`);
  if (user.paypal_subscription_id) {
    return fail(
      400,
      'already_subscribed',
      'This account already has a PayPal subscription. Cancel it first, then subscribe to the new plan.',
    );
  }

  const planId = paypalPlanIdFor(paypalPlanIds(env), plan as PlanId);
  if (!planId) {
    return fail(503, 'plan_missing', 'That plan has no PayPal plan configured yet — email hello@stampbench.com.');
  }

  const created = await paypalRequest(creds, 'POST', '/v1/billing/subscriptions', {
    plan_id: planId,
    // The only reliable link from a PayPal event back to an account.
    custom_id: user.id,
    subscriber: { email_address: user.email },
    application_context: {
      brand_name: 'Stampbench',
      shipping_preference: 'NO_SHIPPING',
      // Bills at approval instead of leaving the subscription APPROVED but
      // unpaid, so activation is a matter of seconds rather than a day.
      user_action: 'SUBSCRIBE_NOW',
      payment_method: { payer_selected: 'PAYPAL', payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED' },
      return_url: `${origin}/account?subscribed=paypal`,
      cancel_url: `${origin}/pricing`,
    },
  });
  if (!created.ok) {
    console.error('paypal: subscription create failed', created.status, created.body);
    return fail(502, 'billing_upstream', 'Could not start the PayPal subscription — try again shortly.');
  }

  const url = approvalUrl(created.body);
  if (!url) {
    console.error('paypal: no approval link on subscription', created.body);
    return fail(502, 'billing_upstream', 'PayPal did not return an approval link — try again shortly.');
  }
  return json({ url });
}

/**
 * Self-serve cancellation.
 *
 * PayPal has no hosted equivalent of Stripe's billing portal, so this is the
 * exit. It has to exist and it has to work from our own UI: self-serve exit is
 * a consumer-rights expectation, and the alternative is that every cancellation
 * arrives as an email someone has to action by hand.
 */
async function handlePaypalCancel(env: Env, user: UserRow): Promise<Response> {
  const creds = paypalCreds(env);
  if (!creds) return fail(503, 'billing_disabled', 'PayPal billing is not configured.');
  const schemaGate = await requireBillingSchema(env);
  if (schemaGate) return schemaGate;
  const subscriptionId = user.paypal_subscription_id;
  if (!subscriptionId) return fail(400, 'no_subscription', 'No PayPal subscription on this account.');

  const cancelled = await paypalRequest(
    creds,
    'POST',
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { reason: 'Cancelled by the customer from the Stampbench account page' },
  );
  // 404 = PayPal has no such subscription, 422 = it is already in a state that
  // cannot be cancelled (usually already cancelled). Both mean the customer's
  // intent is satisfied; only a genuine fault should keep them subscribed.
  if (!cancelled.ok && cancelled.status !== 404 && cancelled.status !== 422) {
    console.error('paypal: cancel failed', cancelled.status, cancelled.body);
    return fail(
      502,
      'billing_upstream',
      'Could not cancel with PayPal — try again, or cancel from your PayPal account under Automatic Payments.',
    );
  }

  // Reflect the new state now rather than waiting for the webhook, so the page
  // does not still say "subscribed" after a successful cancellation.
  await refreshPaypalSubscription(env, creds, subscriptionId, user.id);
  return json({ ok: true });
}

/**
 * The PayPal entitlement authority. Everything that grants or removes a plan
 * through PayPal arrives here — never from the browser, which can only ever
 * *start* a subscription and cannot be trusted to report its outcome. The
 * return_url is a navigation, not evidence: anyone can visit it directly.
 */
async function handlePaypalWebhook(request: Request, env: Env): Promise<Response> {
  const creds = paypalCreds(env);
  if (!creds || !env.PAYPAL_WEBHOOK_ID) {
    return fail(503, 'billing_disabled', 'PayPal billing is not configured.');
  }
  const schemaGate = await requireBillingSchema(env);
  if (schemaGate) return schemaGate;
  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, 'too_large', 'Payload too large.');

  const verified = await paypalWebhookVerified(
    creds,
    env.PAYPAL_WEBHOOK_ID,
    readSignatureHeaders(request.headers),
    raw,
  );
  if (!verified) return fail(400, 'bad_signature', 'Signature verification failed.');

  let event: PaypalJson;
  try {
    event = JSON.parse(raw) as PaypalJson;
  } catch {
    return fail(400, 'bad_request', 'Body is not JSON.');
  }

  const type = String(event.event_type ?? '');
  if (!isSubscriptionEvent(type)) return json({ received: true, ignored: type });

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) {
    console.error('paypal: subscription event without an id', type);
    return json({ received: true });
  }

  try {
    const outcome = await refreshPaypalSubscription(env, creds, subscriptionId);
    // 500 asks PayPal to retry, which is right for a transient upstream or D1
    // fault — the alternative is an entitlement that silently never applies.
    if (outcome === 'upstream_error') return fail(500, 'internal', 'Could not read the subscription; please retry.');
  } catch (e) {
    console.error('paypal: webhook handler failed', type, e);
    return fail(500, 'internal', 'Handler failed; please retry.');
  }
  return json({ received: true });
}

// ---------------------------------------------------------------- GDPR

/**
 * Article 20 (portability): everything held about the account, in one JSON
 * document the user can take elsewhere. Deliberately includes the derived
 * rows — usage counters and API-key metadata are personal data too.
 *
 * Password hashes and salts are excluded: they are not useful to the subject
 * and handing them out would only widen the blast radius of a leaked export.
 */
async function handleExportAccount(env: Env, user: UserRow): Promise<Response> {
  const [keys, usage, reports, upgrades, invoices] = await Promise.all([
    env.DB.prepare('SELECT id, prefix, created_at, last_used FROM api_keys WHERE user_id = ?')
      .bind(user.id)
      .all(),
    env.DB.prepare('SELECT feature, period, count FROM usage WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT id, payload, created_at FROM reports WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT id, plan, status, created_at FROM upgrade_requests WHERE user_id = ?')
      .bind(user.id)
      .all(),
    env.DB.prepare('SELECT id, number, customer, status, payload, created_at, updated_at FROM invoices WHERE user_id = ?')
      .bind(user.id)
      .all(),
  ]);
  return json(
    {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        plan: planFor(user.plan).id,
        createdAt: user.created_at,
        stripeCustomerId: user.stripe_customer_id ?? null,
        paypalSubscriptionId: user.paypal_subscription_id ?? null,
      },
      apiKeys: keys.results ?? [],
      usage: usage.results ?? [],
      sharedReports: (reports.results ?? []).map((r) => {
        const row = r as { id: string; payload: string; created_at: number };
        return { id: row.id, createdAt: row.created_at, payload: JSON.parse(row.payload) };
      }),
      upgradeRequests: upgrades.results ?? [],
      savedInvoices: (invoices.results ?? []).map((r) => {
        const row = r as { id: string; number: string; customer: string; status: string; payload: string; created_at: number; updated_at: number };
        return {
          id: row.id,
          number: row.number,
          customer: row.customer,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          draft: JSON.parse(row.payload),
        };
      }),
    },
    200,
    { 'Content-Disposition': 'attachment; filename="stampbench-account-export.json"' },
  );
}

/**
 * Article 17 (erasure). Removes every row keyed to this user and signs them
 * out. Irreversible by design — a "soft delete" that keeps the personal data
 * would not be erasure.
 *
 * A live Stripe subscription is cancelled first: deleting the account while
 * billing continues would keep charging someone who no longer has one, which
 * is both a refund liability and the sort of thing regulators notice. If that
 * cancellation fails the deletion is refused rather than silently orphaning
 * the subscription.
 */
async function handleDeleteAccount(request: Request, env: Env, user: UserRow): Promise<Response> {
  const body = await readJson(request);
  // Deliberate friction: a mis-click, a stale tab, or a CSRF that somehow got
  // past the origin check should not be able to erase an account.
  if (String(body?.confirm ?? '') !== user.email) {
    return fail(400, 'confirm_required', 'Type your email address to confirm deletion.');
  }

  // Same rule as Stripe below: a live PayPal subscription must not outlive the
  // account it belongs to, or PayPal keeps charging someone who no longer has
  // one. Refuse the deletion rather than orphan the subscription.
  const paypal = paypalCreds(env);
  if (user.paypal_subscription_id && paypal) {
    const cancelled = await paypalRequest(
      paypal,
      'POST',
      `/v1/billing/subscriptions/${encodeURIComponent(user.paypal_subscription_id)}/cancel`,
      { reason: 'Stampbench account deleted' },
    );
    if (!cancelled.ok && cancelled.status !== 404 && cancelled.status !== 422) {
      console.error('delete account: paypal cancel failed', cancelled.status, cancelled.body);
      return fail(
        502,
        'billing_cancel_failed',
        'Could not cancel your PayPal subscription, so the account was not deleted. Email hello@stampbench.com and we will do both by hand.',
      );
    }
  }

  if (user.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
    const cancelled = await stripeRequest(
      env,
      'DELETE',
      `/v1/subscriptions/${encodeURIComponent(user.stripe_subscription_id)}`,
    );
    // 404 means Stripe has no such subscription — already gone, nothing to orphan.
    if (!cancelled.ok && cancelled.status !== 404) {
      console.error('delete account: subscription cancel failed', cancelled.status, cancelled.body);
      return fail(
        502,
        'billing_cancel_failed',
        'Could not cancel your subscription, so the account was not deleted. Email hello@stampbench.com and we will do both by hand.',
      );
    }
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM api_keys WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM reports WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM usage WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM upgrade_requests WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM invoices WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);

  const res = json({ ok: true, deleted: true });
  res.headers.append('Set-Cookie', clearSessionCookie());
  res.headers.append('Set-Cookie', clearSessionMarkerCookie());
  return res;
}

// ---------------------------------------------------------------- admin

async function handleAdminSetPlan(request: Request, env: Env): Promise<Response> {
  // This endpoint grants any plan to any account, so it is the highest-value
  // target on the worker. Throttled to make guessing impractical, and compared
  // in constant time so response latency does not reveal a correct prefix.
  if (!(await rateLimit(env, 'admin', clientIp(request), 10, 60 * 60_000))) return TOO_MANY(3600);
  const presented = request.headers.get('X-Admin-Secret') ?? '';
  if (!env.ADMIN_SECRET || !timingSafeEqual(presented, env.ADMIN_SECRET)) {
    return fail(401, 'unauthenticated', 'Bad admin secret.');
  }
  const body = await readJson(request);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const plan = String(body?.plan ?? '');
  if (!(plan in PLANS)) return fail(400, 'bad_request', 'Unknown plan.');
  const result = await env.DB.prepare('UPDATE users SET plan = ? WHERE email = ?').bind(plan, email).run();
  if (!result.meta.changes) return fail(404, 'not_found', 'No user with that email.');
  await env.DB.prepare(
    "UPDATE upgrade_requests SET status = 'done' WHERE email = ? AND status = 'new'",
  )
    .bind(email)
    .run();
  return json({ ok: true, email, plan });
}

// ---------------------------------------------------------------- analytics

/**
 * Record one page view. Fire-and-forget from the asset path via
 * ctx.waitUntil, so it never delays serving the page, and swallowing its own
 * errors, so a counting hiccup can never turn a good page load into a 500.
 * Aggregate only — see analytics.ts for the privacy contract.
 */
async function recordPageView(env: Env, path: string): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO page_views (day, path, count) VALUES (?, ?, 1)
       ON CONFLICT(day, path) DO UPDATE SET count = count + 1`,
    )
      .bind(analyticsDay(new Date()), path)
      .run();
  } catch (e) {
    console.error('page view count failed', e);
  }
}

/**
 * Operator-only traffic summary. Same X-Admin-Secret gate as set-plan; there
 * is nothing personal in the response, only aggregate counts. `days` bounds
 * the window (default 30, max 365).
 */
async function handleAdminAnalytics(request: Request, env: Env, url: URL): Promise<Response> {
  const presented = request.headers.get('X-Admin-Secret') ?? '';
  if (!env.ADMIN_SECRET || !timingSafeEqual(presented, env.ADMIN_SECRET)) {
    return fail(401, 'unauthenticated', 'Bad admin secret.');
  }
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
  const since = analyticsDay(new Date(Date.now() - (days - 1) * 86_400_000));

  const totalRow = await env.DB.prepare('SELECT SUM(count) AS n FROM page_views WHERE day >= ?')
    .bind(since)
    .first<{ n: number | null }>();
  const byDay = await env.DB.prepare(
    'SELECT day, SUM(count) AS views FROM page_views WHERE day >= ? GROUP BY day ORDER BY day DESC',
  )
    .bind(since)
    .all<{ day: string; views: number }>();
  const topPaths = await env.DB.prepare(
    'SELECT path, SUM(count) AS views FROM page_views WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 50',
  )
    .bind(since)
    .all<{ path: string; views: number }>();

  return json({
    since,
    days,
    totalViews: totalRow?.n ?? 0,
    byDay: byDay.results ?? [],
    topPaths: topPaths.results ?? [],
  });
}

// ---------------------------------------------------------------- router

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/health') return json({ ok: true });
  if (path === '/api/ai/status' && method === 'GET') {
    return json({ enabled: !!env.ANTHROPIC_API_KEY });
  }
  // Lets the pricing page choose between "Pay by card" and "Request upgrade"
  // without shipping a broken button when billing is not configured yet.
  if (path === '/api/billing/status' && method === 'GET') {
    // `enabled` means self-serve card checkout (Stripe) — instant activation.
    // `paypal` means the manual path can at least be paid immediately. The
    // two are independent, and the UI words itself differently for each.
    return json({
      enabled: billingLaunchEnabled(env) && !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      paypal: paypalConfigured(env),
      paypalSubscriptions: paypalSubscriptionsEnabled(env),
    });
  }

  // Stripe signs with its own scheme and sends no Origin, so this must sit
  // above the same-origin gate — and it must read the raw body, which is why
  // it does not go through readJson.
  if (path === '/api/stripe/webhook' && method === 'POST') return handleStripeWebhook(request, env);
  // Same reasoning for PayPal: no Origin, and verification covers the exact
  // bytes of the body.
  if (path === '/api/paypal/webhook' && method === 'POST') return handlePaypalWebhook(request, env);
  // Per-account payment hook (auto-invoicing): providers send no Origin, so
  // this too must sit above the same-origin gate. The token IS the auth.
  const hookMatch = path.match(/^\/api\/hooks\/payment\/(sbwh_[a-f0-9]{40})$/);
  if (hookMatch && method === 'POST') return handlePaymentHook(request, env, hookMatch[1]!);

  // Hosted API — key-authed, no cookies, no CSRF concern.
  if (path === '/api/v1/validate' && method === 'POST') return handleHostedApi(request, env, 'validate');
  if (path === '/api/v1/generate' && method === 'POST') return handleHostedApi(request, env, 'generate');
  if (path === '/api/v1/fix' && method === 'POST') return handleHostedApi(request, env, 'fix');

  // Public report fetch (link sharing is the point — but keep it out of search).
  const reportMatch = path.match(/^\/api\/reports\/([A-Za-z0-9]{6,64})$/);
  if (reportMatch && method === 'GET') {
    const row = await env.DB.prepare('SELECT payload, created_at FROM reports WHERE id = ?')
      .bind(reportMatch[1])
      .first<{ payload: string; created_at: number }>();
    if (!row) return fail(404, 'not_found', 'No such report.');
    return json(
      { payload: JSON.parse(row.payload), createdAt: row.created_at },
      200,
      { 'X-Robots-Tag': 'noindex' },
    );
  }

  if (path === '/api/admin/set-plan' && method === 'POST') return handleAdminSetPlan(request, env);
  if (path === '/api/admin/analytics' && method === 'GET') return handleAdminAnalytics(request, env, url);

  // Everything below authenticates with the session cookie, so every
  // state-changing method needs a same-origin Origin — not just POST. A
  // cross-site DELETE is currently stopped by CORS preflight anyway, but that
  // is the browser's guarantee, not ours; account deletion should not rest on
  // it. GET stays open: nothing below it mutates.
  if (method !== 'GET' && method !== 'HEAD' && !originAllowed(request)) {
    return fail(403, 'bad_origin', 'Cross-origin call rejected.');
  }

  if (path === '/api/auth/register' && method === 'POST') return handleRegister(request, env);
  if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, env);
  if (path === '/api/auth/logout' && method === 'POST') {
    const res = json({ ok: true });
    res.headers.append('Set-Cookie', clearSessionCookie());
    res.headers.append('Set-Cookie', clearSessionMarkerCookie());
    return res;
  }

  const user = await sessionUser(request, env);
  if (path === '/api/auth/me' && method === 'GET') {
    if (!user) return fail(401, 'unauthenticated', 'Not signed in.');
    return meResponse(env, user);
  }

  if (!user) return fail(401, 'unauthenticated', 'Sign in first.');

  if (path === '/api/keys' && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id, prefix, created_at, last_used FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    )
      .bind(user.id)
      .all<{ id: string; prefix: string; created_at: number; last_used: number | null }>();
    return json({
      keys: (rows.results ?? []).map((k) => ({
        id: k.id,
        prefix: k.prefix,
        createdAt: k.created_at,
        lastUsed: k.last_used,
      })),
    });
  }
  if (path === '/api/keys' && method === 'POST') return handleCreateKey(env, user);
  const keyMatch = path.match(/^\/api\/keys\/([A-Za-z0-9-]{10,64})$/);
  if (keyMatch && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').bind(keyMatch[1], user.id).run();
    return json({ ok: true });
  }

  if (path === '/api/billing/checkout' && method === 'POST') {
    return handleCheckout(request, env, user, url.origin);
  }
  if (path === '/api/billing/portal' && method === 'POST') {
    return handleBillingPortal(env, user, url.origin);
  }
  if (path === '/api/billing/paypal/subscribe' && method === 'POST') {
    return handlePaypalSubscribe(request, env, user, url.origin);
  }
  if (path === '/api/billing/paypal/cancel' && method === 'POST') {
    return handlePaypalCancel(env, user);
  }

  if (path === '/api/account/export' && method === 'GET') return handleExportAccount(env, user);
  if (path === '/api/account' && method === 'DELETE') return handleDeleteAccount(request, env, user);

  // The payment hook's settings surface (the hook itself is above the gate).
  if (path === '/api/account/payment-hook' && method === 'GET') {
    return json({ configured: Boolean(user.payment_hook_hash) });
  }
  if (path === '/api/account/payment-hook' && method === 'POST') {
    return handleCreatePaymentHook(env, user, url.origin);
  }
  if (path === '/api/account/payment-hook' && method === 'DELETE') {
    await env.DB.prepare('UPDATE users SET payment_hook_hash = NULL WHERE id = ?').bind(user.id).run();
    return json({ ok: true });
  }

  // Erasure for a single shared report, without deleting the whole account.
  // Scoped by user_id so a report id alone is not authority to destroy it.
  const reportDelete = path.match(/^\/api\/reports\/([A-Za-z0-9]{6,64})$/);
  if (reportDelete && method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM reports WHERE id = ? AND user_id = ?')
      .bind(reportDelete[1], user.id)
      .run();
    if (!result.meta.changes) return fail(404, 'not_found', 'No such report on this account.');
    return json({ ok: true });
  }

  // Account-saved invoices (see handleSaveInvoice for the ground rules).
  if (path === '/api/invoices' && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id, number, customer, total, currency, market, status, updated_at FROM invoices WHERE user_id = ? ORDER BY updated_at DESC',
    )
      .bind(user.id)
      .all<{ id: string; number: string; customer: string; total: string; currency: string; market: string; status: string; updated_at: number }>();
    return json({
      invoices: (rows.results ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        customer: r.customer,
        total: r.total,
        currency: r.currency,
        market: r.market,
        status: r.status,
        updatedAt: r.updated_at,
      })),
    });
  }
  const invoiceMatch = path.match(/^\/api\/invoices\/([A-Za-z0-9_-]{6,64})$/);
  if (invoiceMatch && method === 'GET') {
    const row = await env.DB.prepare('SELECT payload, status, updated_at FROM invoices WHERE id = ? AND user_id = ?')
      .bind(invoiceMatch[1], user.id)
      .first<{ payload: string; status: string; updated_at: number }>();
    if (!row) return fail(404, 'not_found', 'No such invoice on this account.');
    return json({ invoice: { id: invoiceMatch[1], payload: row.payload, status: row.status, updatedAt: row.updated_at } });
  }
  if (invoiceMatch && method === 'PUT') return handleSaveInvoice(request, env, user, invoiceMatch[1]!);
  if (invoiceMatch && method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM invoices WHERE id = ? AND user_id = ?')
      .bind(invoiceMatch[1], user.id)
      .run();
    if (!result.meta.changes) return fail(404, 'not_found', 'No such invoice on this account.');
    return json({ ok: true });
  }

  if (path === '/api/features/share' && method === 'POST') {
    return handleShare(request, env, user, url.origin);
  }
  if (path === '/api/features/regress' && method === 'POST') {
    const spent = await meter(env, user.id, user.plan, 'regress');
    if (spent === null) {
      return fail(402, 'quota', `Future-ruleset checks used up for this month (${featureLimit(user.plan, 'regress')} on ${planFor(user.plan).name}). Upgrade for unlimited.`);
    }
    const limit = featureLimit(user.plan, 'regress');
    return json({ ok: true, remaining: limit < 0 ? -1 : limit - spent });
  }
  if (path === '/api/ai/explain' && method === 'POST') return handleAiExplain(request, env, user);
  if (path === '/api/ai/draft' && method === 'POST') return handleAiDraft(request, env, user);
  if (path === '/api/ai/chat' && method === 'POST') return handleAiChat(request, env, user);
  if (path === '/api/upgrade' && method === 'POST') return handleUpgrade(request, env, user);
  // Withdraw a manual upgrade request. Exists because requests made before
  // self-serve billing was switched on would otherwise sit as "pending"
  // forever — the subscription webhook clears them on activation, but a user
  // who changed their mind (or wants the self-serve button instead) needs a
  // way out that is not emailing the operator. Idempotent; own rows only.
  if (path === '/api/upgrade/cancel' && method === 'POST') {
    await env.DB.prepare(
      "UPDATE upgrade_requests SET status = 'done' WHERE user_id = ? AND status = 'new'",
    )
      .bind(user.id)
      .run();
    return json({ ok: true });
  }

  return fail(404, 'not_found', 'No such endpoint.');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (e) {
        console.error('api error', url.pathname, e);
        return fail(500, 'internal', 'Something broke on our side — try again.');
      }
    }

    const res = await env.ASSETS.fetch(request);

    // Count real page loads only: a served (2xx) HTML navigation, never an
    // asset, redirect or 404. The count runs after the response is returned,
    // so it adds no latency, and its path is aggregate — see analytics.ts.
    const path = countablePath(
      request.url,
      request.method,
      request.headers.get('Accept'),
      request.headers.get('User-Agent'),
    );
    if (path && res.ok && (res.headers.get('Content-Type') ?? '').includes('text/html')) {
      ctx.waitUntil(recordPageView(env, path));
    }
    return res;
  },
};

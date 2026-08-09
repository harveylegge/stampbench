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
  generateXRechnungUbl,
  fixXml,
  validateXml,
  withComputedTotals,
  withXRechnungDefaults,
  type Invoice,
} from '@stampbench/core';
import Anthropic from '@anthropic-ai/sdk';
import {
  AI_GLOBAL_MONTHLY_CAP,
  FEATURE_LIMITS,
  PLANS,
  currentPeriodKey,
  featureLimit,
  planFor,
  type FeatureId,
  type PlanId,
} from '../../../apps/web/lib/plans';
import {
  planFromSubscription,
  stripeSignatureValid,
  subscriptionEntitles,
} from './stripe';
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
  /** Unset = AI explanations disabled site-wide; the UI hides the button. */
  ANTHROPIC_API_KEY?: string;
  /** Override the explanation model; defaults to Haiku per the cost budget. */
  AI_MODEL?: string;
  /** Unset = self-serve billing disabled; the UI falls back to Request-upgrade. */
  STRIPE_SECRET_KEY?: string;
  /** Required whenever STRIPE_SECRET_KEY is set — unsigned webhooks are refused. */
  STRIPE_WEBHOOK_SECRET?: string;
}

const MAX_BODY = 1_500_000; // ~1.5 MB — the largest official test invoice is far smaller
const NEUTRAL_AUTH_ERROR = 'Email or password is incorrect.';

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
    // (Stripe's portal), everyone else gets the upgrade options.
    billing: {
      enabled: !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
      subscribed: !!user.stripe_subscription_id,
      hasCustomer: !!user.stripe_customer_id,
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
    'INSERT INTO users (id, email, pw_hash, pw_salt, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, email, hash, salt, 'free', now)
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

  try {
    if (op === 'validate') {
      const xml = String(body.xml ?? '');
      if (!xml.trim()) return fail(400, 'bad_request', 'Provide { "xml": "…" }.');
      return json({ result: validateXml(xml, { profile: 'xrechnung' }) as unknown as Json });
    }
    if (op === 'fix') {
      const xml = String(body.xml ?? '');
      if (!xml.trim()) return fail(400, 'bad_request', 'Provide { "xml": "…" }.');
      return json({ result: fixXml(xml) as unknown as Json });
    }
    const invoice = body.invoice;
    if (!invoice || typeof invoice !== 'object') return fail(400, 'bad_request', 'Provide { "invoice": { … } }.');
    const full = withComputedTotals(withXRechnungDefaults(invoice as Invoice));
    return json({ xml: generateXRechnungUbl(full) });
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

async function handleUpgrade(request: Request, env: Env, user: UserRow): Promise<Response> {
  const body = await readJson(request);
  const plan = String(body?.plan ?? '');
  if (!(plan in PLANS) || plan === 'free') return fail(400, 'bad_request', 'Unknown plan.');
  await env.DB.prepare(
    'INSERT INTO upgrade_requests (id, user_id, email, plan, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), user.id, user.email, plan, Date.now())
    .run();

  // Best-effort notification: the request row above is the durable record.
  // `mailed`/`mailError` in the response exist for observability — the static
  // site has no server logs a human ever reads.
  let mailed = false;
  let mailError: string | null = env.MAILER ? null : 'MAILER binding missing';
  if (env.MAILER) {
    const p = PLANS[plan as PlanId];
    const activate = `$h=@{'X-Admin-Secret'='<ADMIN_SECRET>';'Content-Type'='application/json'}; Invoke-RestMethod -Method Post -Uri https://stampbench.com/api/admin/set-plan -Headers $h -Body '{"email":"${user.email}","plan":"${plan}"}'`;
    try {
      const res = await env.MAILER.fetch('https://mailer.internal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Stampbench upgrade request: ${user.email} → ${p.name} (£${p.priceGbp}/mo)`,
          text:
            `${user.email} asked for the ${p.name} plan (£${p.priceGbp}/month).\n\n` +
            `They have NOT paid yet — arrange payment, then activate with:\n\n${activate}\n\n` +
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
  return json({ ok: true, mailed, ...(mailError ? { mailError } : {}) });
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
  if (!env.STRIPE_SECRET_KEY) {
    return fail(503, 'billing_disabled', 'Card payment is not switched on yet — use Request upgrade.');
  }
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
  const [keys, usage, reports, upgrades] = await Promise.all([
    env.DB.prepare('SELECT id, prefix, created_at, last_used FROM api_keys WHERE user_id = ?')
      .bind(user.id)
      .all(),
    env.DB.prepare('SELECT feature, period, count FROM usage WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT id, payload, created_at FROM reports WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT id, plan, status, created_at FROM upgrade_requests WHERE user_id = ?')
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
      },
      apiKeys: keys.results ?? [],
      usage: usage.results ?? [],
      sharedReports: (reports.results ?? []).map((r) => {
        const row = r as { id: string; payload: string; created_at: number };
        return { id: row.id, createdAt: row.created_at, payload: JSON.parse(row.payload) };
      }),
      upgradeRequests: upgrades.results ?? [],
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
    return json({ enabled: !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) });
  }

  // Stripe signs with its own scheme and sends no Origin, so this must sit
  // above the same-origin gate — and it must read the raw body, which is why
  // it does not go through readJson.
  if (path === '/api/stripe/webhook' && method === 'POST') return handleStripeWebhook(request, env);

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

  if (path === '/api/account/export' && method === 'GET') return handleExportAccount(env, user);
  if (path === '/api/account' && method === 'DELETE') return handleDeleteAccount(request, env, user);

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
  if (path === '/api/upgrade' && method === 'POST') return handleUpgrade(request, env, user);

  return fail(404, 'not_found', 'No such endpoint.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (e) {
        console.error('api error', url.pathname, e);
        return fail(500, 'internal', 'Something broke on our side — try again.');
      }
    }
    return env.ASSETS.fetch(request);
  },
};

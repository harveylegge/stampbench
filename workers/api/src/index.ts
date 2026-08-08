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
import {
  FEATURE_LIMITS,
  PLANS,
  currentPeriodKey,
  featureLimit,
  planFor,
  type FeatureId,
  type PlanId,
} from '../../../apps/web/lib/plans';
import {
  clearSessionCookie,
  clearSessionMarkerCookie,
  hashPassword,
  readCookie,
  sessionCookie,
  sessionMarkerCookie,
  sha256Hex,
  signSession,
  verifyPassword,
  verifySession,
  SESSION_COOKIE,
  type Session,
} from './auth';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MAILER?: Fetcher;
  JWT_SECRET: string;
  ADMIN_SECRET: string;
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

/** Same-origin guard for cookie-authenticated mutations. */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  return (
    origin === 'https://stampbench.com' ||
    origin.endsWith('.stampbench.pages.dev') ||
    origin.startsWith('http://localhost:')
  );
}

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
  });
  for (const cookie of setCookies ?? []) res.headers.append('Set-Cookie', cookie);
  return res;
}

// ---------------------------------------------------------------- auth

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'invalid_email', 'Enter a valid email address.');
  if (password.length < 10) return fail(400, 'weak_password', 'Password must be at least 10 characters.');

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
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!user) return fail(401, 'bad_credentials', NEUTRAL_AUTH_ERROR);
  if (!(await verifyPassword(password, user.pw_hash, user.pw_salt))) {
    return fail(401, 'bad_credentials', NEUTRAL_AUTH_ERROR);
  }
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

// ---------------------------------------------------------------- admin

async function handleAdminSetPlan(request: Request, env: Env): Promise<Response> {
  if (request.headers.get('X-Admin-Secret') !== env.ADMIN_SECRET) {
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

  // Everything below uses the session cookie; mutations need a same-origin Origin.
  if (method === 'POST' && !originAllowed(request)) {
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

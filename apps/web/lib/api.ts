import 'server-only';
import { NextResponse } from 'next/server';
import { authenticateApiKey } from './api-keys';
import { getCurrentUser } from './auth';
import { clientIp, rateLimit } from './ratelimit';
import { checkQuota } from './usage';
import { planFor } from './plans';
import { log } from './log';

export const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB — invoices are small

export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export type Caller =
  | { type: 'key'; userId: string; apiKeyId: string; plan: string }
  | { type: 'session'; userId: string; plan: string }
  | { type: 'anon'; ip: string };

/** True when the caller presented an API-key credential (valid or not). */
function presentedApiKey(request: Request): boolean {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return true;
  return Boolean(request.headers.get('x-api-key'));
}

/**
 * Resolve who is calling: API key, then browser session, then anonymous.
 * Returns `'invalid_key'` when a credential was presented but does not
 * authenticate — the caller must NOT be silently downgraded to the anonymous
 * trial pool (that would mask revoked keys and let anyone bypass quota by
 * sending a junk key).
 */
export async function resolveCaller(request: Request): Promise<Caller | 'invalid_key'> {
  const keyAuth = await authenticateApiKey(request);
  if (keyAuth) return { type: 'key', ...keyAuth };
  if (presentedApiKey(request)) return 'invalid_key';
  const user = await getCurrentUser().catch(() => null);
  if (user) return { type: 'session', userId: user.id, plan: user.plan };
  return { type: 'anon', ip: clientIp(request) };
}

export interface GateResult {
  ok: true;
  caller: Caller;
  headers: Record<string, string>;
}

/**
 * Rate-limit + quota gate for the public API.
 * Anonymous callers get a small trial allowance per IP; authenticated callers
 * get their plan's rate limit and monthly quota.
 */
export async function gateRequest(
  request: Request,
): Promise<GateResult | NextResponse> {
  const caller = await resolveCaller(request);

  if (caller === 'invalid_key') {
    return apiError(401, 'invalid_api_key',
      'The API key is missing, malformed, or has been revoked. Check your key in the dashboard.');
  }

  if (caller.type === 'anon') {
    // 10 requests/hour per IP — enough to evaluate, not enough to freeload.
    const rl = await rateLimit(`anon:${caller.ip}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return apiError(429, 'rate_limited',
        'Anonymous trial limit reached (10 requests/hour). Create a free account for 100 calls/month: https://stampbench.com/register',
        { retryAfterMs: rl.resetAt - Date.now() });
    }
    return { ok: true, caller, headers: { 'X-RateLimit-Remaining': String(rl.remaining) } };
  }

  const plan = planFor(caller.plan);
  const rlKey = caller.type === 'key' ? `key:${caller.apiKeyId}` : `user:${caller.userId}`;
  const rl = await rateLimit(rlKey, plan.rateLimitPerMinute, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Rate limit exceeded (${plan.rateLimitPerMinute}/min on the ${plan.name} plan).`, {
      retryAfterMs: rl.resetAt - Date.now(),
    });
  }

  const quota = await checkQuota(caller.userId, caller.plan);
  if (!quota.allowed) {
    log.info('api.quota_exceeded', { userId: caller.userId, plan: caller.plan });
    return apiError(402, 'quota_exceeded',
      `Monthly quota reached (${quota.used}/${quota.quota} on the ${quota.plan.name} plan). Upgrade at https://stampbench.com/pricing`,
      { used: quota.used, quota: quota.quota });
  }

  return {
    ok: true,
    caller,
    headers: {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-Quota-Used': String(quota.used),
      'X-Quota-Limit': String(quota.quota),
    },
  };
}

/** Read a bounded text body; returns null (and a response) when too large. */
export async function readBoundedText(request: Request): Promise<string | NextResponse> {
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    return apiError(413, 'payload_too_large', 'Request body exceeds 2 MB.');
  }
  return text;
}

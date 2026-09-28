import 'server-only';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { assertProductionSecrets, env, features } from './env';
import { clientIp, rateLimit } from './ratelimit';

function fingerprint(value: string): string {
  return createHash('sha256').update(`${env.sessionSecret}:${value}`).digest('hex').slice(0, 24);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    return new URL(origin).origin === new URL(env.appUrl).origin;
  } catch {
    return false;
  }
}

export async function guardMutation(
  request: Request,
  scope: string,
  options: { userId?: string; limit?: number; windowMs?: number } = {},
): Promise<NextResponse | null> {
  assertProductionSecrets();
  if (env.isProd && !features.distributedRateLimit) {
    return NextResponse.json(
      { error: { code: 'security_unavailable', message: 'Request protection is temporarily unavailable.' } },
      { status: 503 },
    );
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: { code: 'invalid_origin', message: 'Cross-site request rejected.' } }, { status: 403 });
  }
  const identity = options.userId ? `user:${options.userId}` : `ip:${fingerprint(clientIp(request))}`;
  const result = await rateLimit(`mutation:${scope}:${identity}`, options.limit ?? 20, options.windowMs ?? 60_000);
  if (result.allowed) return null;
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Remaining': '0' } },
  );
}

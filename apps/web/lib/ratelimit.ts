import 'server-only';
import { env, features } from './env';
import { log } from './log';

/**
 * Sliding-window rate limiter.
 * - With Upstash env vars: distributed, correct across serverless instances.
 * - Without: in-memory fallback (fine for a single dev/preview instance).
 */

interface Window {
  count: number;
  resetAt: number;
}

const memory = new Map<string, Window>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const w = memory.get(key);
  if (!w || w.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  w.count += 1;
  return { allowed: w.count <= limit, remaining: Math.max(0, limit - w.count), resetAt: w.resetAt };
  }

// Opportunistic GC so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, w] of memory) if (w.resetAt <= now) memory.delete(k);
}, 60_000).unref?.();

async function upstashLimit(key: string, limit: number, windowMs: number) {
  const windowId = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${key}:${windowId}`;
  try {
    const res = await fetch(`${env.upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(windowMs)],
      ]),
      // A hung limiter must not take the API down with it.
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data[0]?.result ?? 1;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: (windowId + 1) * windowMs,
    };
  } catch (e) {
    log.warn('ratelimit.upstash_error', { message: (e as Error).message });
    return memoryLimit(key, limit, windowMs); // degrade, don't fail closed
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (features.distributedRateLimit) return upstashLimit(key, limit, windowMs);
  return memoryLimit(key, limit, windowMs);
}

/** Best-effort client IP for anonymous rate limiting. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

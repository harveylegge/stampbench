import { describe, expect, it } from 'vitest';
import { currentPeriodStart, planFor, PLANS } from '../lib/plans';
import { generateApiKey, hashApiKey } from '../lib/api-keys';
import { rateLimit } from '../lib/ratelimit';

describe('plans', () => {
  it('falls back to free for unknown plan ids', () => {
    expect(planFor('nonsense').id).toBe('free');
    expect(planFor(null).id).toBe('free');
    expect(planFor('pro').id).toBe('pro');
  });

  it('quotas strictly increase across tiers', () => {
    expect(PLANS.free.monthlyQuota).toBeLessThan(PLANS.starter.monthlyQuota);
    expect(PLANS.starter.monthlyQuota).toBeLessThan(PLANS.pro.monthlyQuota);
    expect(PLANS.pro.monthlyQuota).toBeLessThan(PLANS.scale.monthlyQuota);
  });

  it('period start is the first of the month at UTC midnight', () => {
    const start = currentPeriodStart(new Date('2026-08-15T13:45:00Z'));
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('api keys', () => {
  it('generates prefixed, high-entropy keys with a stable hash', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).toMatch(/^ig_live_[0-9a-f]{48}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.prefix).toBe(a.key.slice(0, 15));
    expect(hashApiKey(a.key)).toBe(a.keyHash);
    expect(hashApiKey(a.key)).toHaveLength(64); // sha256 hex
    expect(a.keyHash).not.toBe(b.keyHash);
  });
});

describe('rate limiter (in-memory fallback)', () => {
  it('allows up to the limit then blocks within the window', async () => {
    const key = `test:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60_000));
    expect(results[0]?.allowed).toBe(true);
    expect(results[2]?.allowed).toBe(true);
    expect(results[3]?.allowed).toBe(false);
    expect(results[3]?.remaining).toBe(0);
  });

  it('scopes windows per key', async () => {
    const a = await rateLimit(`a:${Math.random()}`, 1, 60_000);
    const b = await rateLimit(`b:${Math.random()}`, 1, 60_000);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});

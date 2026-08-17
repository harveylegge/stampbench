/**
 * Tests for the two pure decisions in the billing path.
 *
 * These guard the entitlement boundary: `stripeSignatureValid` is the only
 * thing standing between a forged HTTP request and a free plan upgrade, and
 * `planFromSubscription` decides which tier a payment buys. Both are easy to
 * get subtly wrong in a way that manual testing never surfaces — a broken
 * signature check still works perfectly for genuine Stripe traffic.
 */
import { describe, expect, it, vi } from 'vitest';
import { hmacSha256Hex, signSession, verifySession } from '../../../workers/api/src/auth';
import {
  planFromSubscription,
  stripeSignatureValid,
  subscriptionApplies,
  subscriptionEntitles,
  WEBHOOK_TOLERANCE_SECONDS,
} from '../../../workers/api/src/stripe';
import { paypalLink } from '../../../workers/api/src/paypal';
import { isPlanId, planFor, PLANS as PLAN_TABLE } from '../lib/plans';

const SECRET = 'whsec_test_0123456789abcdef';
const BODY = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated' });
const NOW_MS = 1_786_000_000_000;

/** Build the header Stripe would send for `body` at `atSeconds`. */
async function signature(body: string, atSeconds: number, secret = SECRET): Promise<string> {
  const v1 = await hmacSha256Hex(secret, `${atSeconds}.${body}`);
  return `t=${atSeconds},v1=${v1}`;
}

const PLANS = ['free', 'starter', 'pro', 'scale'];

describe('stripeSignatureValid', () => {
  it('accepts a correctly signed, current payload', async () => {
    const header = await signature(BODY, NOW_MS / 1000);
    expect(await stripeSignatureValid(BODY, header, SECRET, NOW_MS)).toBe(true);
  });

  it('rejects a tampered body under an otherwise valid signature', async () => {
    const header = await signature(BODY, NOW_MS / 1000);
    const tampered = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.deleted' });
    expect(await stripeSignatureValid(tampered, header, SECRET, NOW_MS)).toBe(false);
  });

  it('rejects a signature made with a different secret', async () => {
    const header = await signature(BODY, NOW_MS / 1000, 'whsec_someone_elses_secret');
    expect(await stripeSignatureValid(BODY, header, SECRET, NOW_MS)).toBe(false);
  });

  it('rejects a replayed delivery once it falls outside the tolerance', async () => {
    const signedAt = NOW_MS / 1000;
    const header = await signature(BODY, signedAt);
    // Still genuine, still correctly signed — only old.
    const justInside = NOW_MS + (WEBHOOK_TOLERANCE_SECONDS - 1) * 1000;
    const justOutside = NOW_MS + (WEBHOOK_TOLERANCE_SECONDS + 1) * 1000;
    expect(await stripeSignatureValid(BODY, header, SECRET, justInside)).toBe(true);
    expect(await stripeSignatureValid(BODY, header, SECRET, justOutside)).toBe(false);
  });

  it('rejects a timestamp from the future beyond tolerance', async () => {
    const header = await signature(BODY, NOW_MS / 1000 + WEBHOOK_TOLERANCE_SECONDS + 60);
    expect(await stripeSignatureValid(BODY, header, SECRET, NOW_MS)).toBe(false);
  });

  it('accepts when any one of several v1 candidates matches', async () => {
    // Stripe sends one v1 per active endpoint secret during a rotation.
    const good = await hmacSha256Hex(SECRET, `${NOW_MS / 1000}.${BODY}`);
    const header = `t=${NOW_MS / 1000},v1=${'0'.repeat(64)},v1=${good}`;
    expect(await stripeSignatureValid(BODY, header, SECRET, NOW_MS)).toBe(true);
  });

  it('rejects malformed, empty, and missing headers', async () => {
    for (const header of [null, '', 'garbage', `t=${NOW_MS / 1000}`, 'v1=abc']) {
      expect(await stripeSignatureValid(BODY, header, SECRET, NOW_MS)).toBe(false);
    }
  });

  it('rejects even a genuine delivery when no endpoint secret is configured', async () => {
    // Misconfiguration must fail closed. An unset STRIPE_WEBHOOK_SECRET means
    // nothing can be verified, so nothing may be trusted — the alternative is
    // an endpoint that grants plans to anyone who can POST to it.
    const header = await signature(BODY, NOW_MS / 1000);
    expect(await stripeSignatureValid(BODY, header, '', NOW_MS)).toBe(false);
  });
});

describe('planFromSubscription', () => {
  const withPrice = (metadata: unknown) => ({ items: { data: [{ price: { metadata } }] } });

  it('reads the plan id from the price metadata', () => {
    expect(planFromSubscription(withPrice({ plan_id: 'pro' }), PLANS)).toBe('pro');
  });

  it('grants nothing for an unknown plan id', () => {
    expect(planFromSubscription(withPrice({ plan_id: 'enterprise' }), PLANS)).toBeNull();
  });

  it('refuses to treat "free" as a purchasable plan', () => {
    expect(planFromSubscription(withPrice({ plan_id: 'free' }), PLANS)).toBeNull();
  });

  it('fails closed on missing or malformed structures', () => {
    expect(planFromSubscription(withPrice({}), PLANS)).toBeNull();
    expect(planFromSubscription(withPrice({ plan_id: 42 }), PLANS)).toBeNull();
    expect(planFromSubscription({ items: { data: [] } }, PLANS)).toBeNull();
    expect(planFromSubscription({}, PLANS)).toBeNull();
  });
});

describe('subscriptionEntitles', () => {
  it('entitles only active and trialing subscriptions', () => {
    expect(subscriptionEntitles('active')).toBe(true);
    expect(subscriptionEntitles('trialing')).toBe(true);
  });

  it('does not entitle a subscription whose payment is failing or finished', () => {
    // past_due matters most: Stripe retries a dead card for weeks, and serving
    // the paid tier throughout would be unpaid service.
    for (const status of ['past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', undefined]) {
      expect(subscriptionEntitles(status)).toBe(false);
    }
  });
});

describe('subscriptionApplies', () => {
  it('always applies an entitling subscription', () => {
    // A live subscription reporting itself becomes the account's current one,
    // whatever was recorded before.
    expect(subscriptionApplies('sub_new', true, 'sub_old')).toBe(true);
    expect(subscriptionApplies('sub_new', true, null)).toBe(true);
  });

  it('applies a cancellation for the subscription the account is actually on', () => {
    expect(subscriptionApplies('sub_a', false, 'sub_a')).toBe(true);
  });

  it('ignores a cancellation for a subscription the account already replaced', () => {
    // Stripe retries deliveries for days and promises no ordering, so a
    // `deleted` for the old subscription can land after the replacement is
    // live. Applying it downgrades someone who is paying, and nothing
    // re-grants the plan until the new subscription's next event — a month
    // away for a healthy monthly plan.
    expect(subscriptionApplies('sub_old', false, 'sub_new')).toBe(false);
  });

  it('applies when there is no recorded subscription to protect', () => {
    expect(subscriptionApplies('sub_a', false, null)).toBe(true);
    expect(subscriptionApplies('sub_a', false, undefined)).toBe(true);
  });
});

/**
 * Plan ids arrive from request bodies and database columns, and index a plain
 * object literal — so the membership test has to be an own-property check.
 */
describe('plan id validation', () => {
  it('accepts exactly the real plans', () => {
    for (const id of ['free', 'starter', 'pro', 'scale']) expect(isPlanId(id), id).toBe(true);
  });

  it('rejects inherited Object.prototype keys', () => {
    // `id in PLANS` walks the prototype chain, so every one of these passed
    // the old check and then indexed PLANS to something that is not a Plan:
    // planFor('constructor') returned the Object constructor, whose `.id` is
    // undefined, which made featureLimit() throw on every metered request.
    for (const id of ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__']) {
      expect(isPlanId(id), id).toBe(false);
      expect(planFor(id), id).toBe(PLAN_TABLE.free);
    }
  });

  it('falls back to free for unknown, empty and nullish ids', () => {
    for (const id of ['enterprise', '', null, undefined]) {
      expect(planFor(id), String(id)).toBe(PLAN_TABLE.free);
    }
  });
});

/**
 * The session cookie is attacker-supplied and can also simply be truncated by
 * a client, so verifySession must answer null for anything it cannot verify —
 * never throw. Throwing surfaces as a 500 on every authenticated route, and
 * /api/auth/me answering 500 instead of 401 strands the browser: the client
 * treats only 401 as "signed out", so the account page errors instead of
 * offering a sign-in.
 */
describe('verifySession', () => {
  const SESSION_SECRET = 'session_secret_for_tests';

  it('round-trips a session it signed', async () => {
    const token = await signSession('user_1', 'a@b.com', SESSION_SECRET);
    expect(await verifySession(token, SESSION_SECRET)).toEqual({ sub: 'user_1', email: 'a@b.com' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession('user_1', 'a@b.com', SESSION_SECRET);
    expect(await verifySession(token, 'someone_elses_secret')).toBeNull();
  });

  it('rejects a tampered payload under an otherwise well-formed token', async () => {
    const token = await signSession('user_1', 'a@b.com', SESSION_SECRET);
    const [header, , sig] = token.split('.');
    const forged = btoa(JSON.stringify({ sub: 'admin', email: 'a@b.com', exp: 4_102_444_800 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await verifySession(`${header}.${forged}.${sig}`, SESSION_SECRET)).toBeNull();
  });

  it('returns null rather than throwing on a malformed cookie', async () => {
    const [header, payload] = (await signSession('user_1', 'a@b.com', SESSION_SECRET)).split('.');
    for (const token of [
      'x.y.z', //                      signature length ≡ 1 mod 4 — atob throws
      `${header}.${payload}.!!!!`, //  characters outside the base64 alphabet
      `${header}.${payload}.`, //      empty signature
      `${header}.@@@@@@@@.${'A'.repeat(43)}`, // undecodable payload, valid shape
      '..',
      'not-a-token',
      '',
    ]) {
      await expect(verifySession(token, SESSION_SECRET), token).resolves.toBeNull();
    }
  });

  it('rejects a session past its expiry', async () => {
    // Only Date is faked: the crypto calls below are real promises and must
    // still settle.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const token = await signSession('user_1', 'a@b.com', SESSION_SECRET);
      expect(await verifySession(token, SESSION_SECRET)).not.toBeNull();
      vi.setSystemTime(new Date('2026-03-01T00:00:00Z')); // 30-day life, long gone
      expect(await verifySession(token, SESSION_SECRET)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * The PayPal link is the first thing a paying customer touches, and it is
 * built from a value a human pastes into a secrets UI. A malformed handle
 * produces a dead link that fails at the exact moment someone is trying to
 * give us money, so the normalisation is tested rather than assumed.
 */
describe('paypal link', () => {
  it('appends the plan price to a bare handle', () => {
    expect(paypalLink({ me: 'harveylegge' }, 'starter')).toBe(
      'https://www.paypal.me/harveylegge/29GBP',
    );
    expect(paypalLink({ me: 'harveylegge' }, 'pro')).toBe('https://www.paypal.me/harveylegge/99GBP');
    expect(paypalLink({ me: 'harveylegge' }, 'scale')).toBe(
      'https://www.paypal.me/harveylegge/299GBP',
    );
  });

  it('accepts every form someone might paste', () => {
    const expected = 'https://www.paypal.me/harveylegge/29GBP';
    for (const me of [
      'harveylegge',
      '@harveylegge',
      'https://paypal.me/harveylegge',
      'https://www.paypal.me/harveylegge',
      'https://paypal.me/harveylegge/',
      '  harveylegge  ',
    ]) {
      expect(paypalLink({ me }, 'starter'), me).toBe(expected);
    }
  });

  it('prefers an explicit per-plan link over the handle', () => {
    const config = { me: 'harveylegge', pro: 'https://www.paypal.com/ncp/payment/ABC123' };
    expect(paypalLink(config, 'pro')).toBe('https://www.paypal.com/ncp/payment/ABC123');
    // Plans without their own link still fall back to the handle.
    expect(paypalLink(config, 'starter')).toBe('https://www.paypal.me/harveylegge/29GBP');
  });

  it('returns null when PayPal is not configured, so the UI keeps the old wording', () => {
    expect(paypalLink({}, 'pro')).toBeNull();
    expect(paypalLink({ me: '' }, 'pro')).toBeNull();
    expect(paypalLink({ me: '@' }, 'pro')).toBeNull();
    // 'free' has no price and must never produce a payment link.
    expect(paypalLink({ me: 'harveylegge' }, 'free')).toBeNull();
  });
});

/**
 * Tests for the pure decisions in the PayPal Subscriptions path.
 *
 * Same reasoning as the Stripe billing tests next door: these functions sit on
 * the entitlement boundary, where a subtle mistake is invisible in manual
 * testing and expensive in production. A verification body that does not
 * round-trip byte-for-byte rejects every genuine webhook (nobody's plan ever
 * activates); a plan mapping that matches too eagerly grants a tier nobody
 * paid for; a stale-cancellation rule that is too loose revokes a plan
 * somebody is paying for.
 */
import { describe, expect, it } from 'vitest';
import {
  approvalUrl,
  certUrlIsPaypal,
  isSubscriptionEvent,
  paypalApiBase,
  paypalPlanIdFor,
  paypalSubscriptionEntitles,
  planFromPaypalPlanId,
  revokeApplies,
  subscriptionIdFromEvent,
  verificationRequestBody,
  type PaypalSignatureHeaders,
} from '../../../workers/api/src/paypal-subscriptions';
import { PAYPAL_TIERS, WEBHOOK_EVENTS } from '../../../workers/api/scripts/paypal-setup.mjs';
import { PLANS } from '../lib/plans';

const PLAN_IDS = { starter: 'P-STARTER1', pro: 'P-PRO222', scale: 'P-SCALE33' };

describe('paypalApiBase', () => {
  it('keeps sandbox and live apart', () => {
    expect(paypalApiBase({ clientId: 'x', secret: 'y', env: 'live' })).toBe('https://api-m.paypal.com');
    expect(paypalApiBase({ clientId: 'x', secret: 'y', env: 'sandbox' })).toBe(
      'https://api-m.sandbox.paypal.com',
    );
  });
});

describe('paypalPlanIdFor', () => {
  it('resolves each configured tier', () => {
    expect(paypalPlanIdFor(PLAN_IDS, 'starter')).toBe('P-STARTER1');
    expect(paypalPlanIdFor(PLAN_IDS, 'pro')).toBe('P-PRO222');
    expect(paypalPlanIdFor(PLAN_IDS, 'scale')).toBe('P-SCALE33');
  });

  it('has nothing to sell for free, or for an unconfigured tier', () => {
    expect(paypalPlanIdFor(PLAN_IDS, 'free')).toBeNull();
    expect(paypalPlanIdFor({ starter: 'P-1' }, 'pro')).toBeNull();
    expect(paypalPlanIdFor({ pro: '   ' }, 'pro')).toBeNull();
  });
});

describe('planFromPaypalPlanId', () => {
  it('maps a configured PayPal plan back to its tier', () => {
    expect(planFromPaypalPlanId(PLAN_IDS, 'P-PRO222')).toBe('pro');
    expect(planFromPaypalPlanId(PLAN_IDS, ' P-SCALE33 ')).toBe('scale');
  });

  it('grants nothing for a plan id this deployment does not know', () => {
    // A plan created by hand in the dashboard, or a sandbox id in a live
    // environment. Guessing a tier here would be worse than granting none.
    expect(planFromPaypalPlanId(PLAN_IDS, 'P-SOMETHING-ELSE')).toBeNull();
  });

  it('never matches an unconfigured tier', () => {
    // The failure that matters: if both sides were compared while empty, every
    // unknown subscription would resolve to whichever tier was left unset.
    expect(planFromPaypalPlanId({}, '')).toBeNull();
    expect(planFromPaypalPlanId({ pro: undefined }, undefined)).toBeNull();
    expect(planFromPaypalPlanId({ starter: '' }, '')).toBeNull();
    expect(planFromPaypalPlanId({ scale: '  ' }, '  ')).toBeNull();
  });

  it('fails closed on malformed input', () => {
    expect(planFromPaypalPlanId(PLAN_IDS, 42)).toBeNull();
    expect(planFromPaypalPlanId(PLAN_IDS, null)).toBeNull();
    expect(planFromPaypalPlanId(PLAN_IDS, { id: 'P-PRO222' })).toBeNull();
  });
});

describe('paypalSubscriptionEntitles', () => {
  it('entitles only an ACTIVE subscription', () => {
    expect(paypalSubscriptionEntitles('ACTIVE')).toBe(true);
  });

  it('does not entitle a subscription that is unapproved, suspended or over', () => {
    // APPROVED matters most: the buyer agreed but PayPal has not taken the
    // first payment, so serving the paid tier would be unpaid service.
    for (const status of [
      'APPROVAL_PENDING',
      'APPROVED',
      'SUSPENDED',
      'CANCELLED',
      'EXPIRED',
      'active',
      '',
      undefined,
      null,
    ]) {
      expect(paypalSubscriptionEntitles(status), String(status)).toBe(false);
    }
  });
});

describe('isSubscriptionEvent', () => {
  it('accepts the events the worker acts on', () => {
    expect(isSubscriptionEvent('BILLING.SUBSCRIPTION.ACTIVATED')).toBe(true);
    expect(isSubscriptionEvent('BILLING.SUBSCRIPTION.CANCELLED')).toBe(true);
    expect(isSubscriptionEvent('PAYMENT.SALE.COMPLETED')).toBe(true);
  });

  it('ignores CREATED — a subscription exists before anyone has approved it', () => {
    expect(isSubscriptionEvent('BILLING.SUBSCRIPTION.CREATED')).toBe(false);
  });

  it('ignores plan and product administration, and anything unrecognised', () => {
    for (const type of [
      'BILLING.PLAN.UPDATED',
      'CATALOG.PRODUCT.CREATED',
      'CHECKOUT.ORDER.APPROVED',
      'nonsense',
      '',
      undefined,
    ]) {
      expect(isSubscriptionEvent(type), String(type)).toBe(false);
    }
  });
});

describe('subscriptionIdFromEvent', () => {
  it('reads the subscription id from a subscription event', () => {
    expect(
      subscriptionIdFromEvent({
        event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
        resource: { id: 'I-ABC123', status: 'ACTIVE' },
      }),
    ).toBe('I-ABC123');
  });

  it('reads billing_agreement_id from a renewal payment', () => {
    // The resource of PAYMENT.SALE.COMPLETED is a *sale*: `id` is the sale id
    // and would match no subscription at all.
    expect(
      subscriptionIdFromEvent({
        event_type: 'PAYMENT.SALE.COMPLETED',
        resource: { id: 'SALE-999', billing_agreement_id: 'I-ABC123' },
      }),
    ).toBe('I-ABC123');
  });

  it('returns null when there is nothing to act on', () => {
    expect(subscriptionIdFromEvent({ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: {} })).toBeNull();
    expect(subscriptionIdFromEvent({ event_type: 'PAYMENT.SALE.COMPLETED' })).toBeNull();
    expect(subscriptionIdFromEvent({})).toBeNull();
  });
});

describe('revokeApplies', () => {
  it('lets a subscription revoke the plan it is granting', () => {
    expect(revokeApplies('I-ABC123', 'I-ABC123')).toBe(true);
  });

  it('refuses to revoke on behalf of a superseded subscription', () => {
    // The resubscribe race: PayPal does not order deliveries, so the old
    // subscription's CANCELLED can land after the new one activated.
    expect(revokeApplies('I-NEW', 'I-OLD')).toBe(false);
  });

  it('refuses to revoke a plan PayPal never granted', () => {
    // An abandoned approval, or a plan activated by hand through the manual
    // upgrade path. Neither is PayPal's to take away.
    expect(revokeApplies(null, 'I-ABANDONED')).toBe(false);
    expect(revokeApplies(undefined, 'I-ABANDONED')).toBe(false);
    expect(revokeApplies('', 'I-ABANDONED')).toBe(false);
    // Two empty values must not compare equal into a revoke.
    expect(revokeApplies('', '')).toBe(false);
  });
});

describe('certUrlIsPaypal', () => {
  it('accepts PayPal-hosted certificates', () => {
    expect(certUrlIsPaypal('https://api.paypal.com/v1/notifications/certs/CERT-abc')).toBe(true);
    expect(certUrlIsPaypal('https://api.sandbox.paypal.com/v1/notifications/certs/CERT-abc')).toBe(true);
    expect(certUrlIsPaypal('https://paypal.com/cert')).toBe(true);
  });

  it('rejects lookalike hosts, plaintext and junk', () => {
    // The substring trap: this host contains "paypal.com" and is not PayPal.
    expect(certUrlIsPaypal('https://api.paypal.com.evil.test/cert')).toBe(false);
    expect(certUrlIsPaypal('https://notpaypal.com/cert')).toBe(false);
    expect(certUrlIsPaypal('http://api.paypal.com/cert')).toBe(false);
    expect(certUrlIsPaypal('not a url')).toBe(false);
    expect(certUrlIsPaypal('')).toBe(false);
    expect(certUrlIsPaypal(null)).toBe(false);
  });
});

describe('verificationRequestBody', () => {
  const headers: PaypalSignatureHeaders = {
    authAlgo: 'SHA256withRSA',
    certUrl: 'https://api.paypal.com/v1/notifications/certs/CERT-1',
    transmissionId: 'b1c2d3',
    transmissionSig: 'sig+with/base64==',
    transmissionTime: '2026-08-12T10:00:00Z',
  };

  it('embeds the delivery body byte-for-byte', () => {
    // The signature covers the exact bytes PayPal sent. Parsing and
    // re-serialising renormalises numbers and escapes — 1.50 becomes 1.5,
    // é becomes é — and every genuine delivery then fails verification.
    const raw = '{"id":"WH-1","amount":1.50,"note":"caf\\u00e9","big":10000000000000000000}';
    const built = verificationRequestBody(headers, 'WH-ID-9', raw);
    expect(built).toContain(`"webhook_event":${raw}`);

    const parsed = JSON.parse(built);
    expect(parsed.webhook_id).toBe('WH-ID-9');
    expect(parsed.auth_algo).toBe('SHA256withRSA');
    expect(parsed.transmission_sig).toBe('sig+with/base64==');
    expect(parsed.transmission_time).toBe('2026-08-12T10:00:00Z');
  });

  it('escapes header values instead of splicing them in raw', () => {
    // Header values arrive from the network. A quote in one of them must not
    // be able to close the string and inject fields into the request.
    const hostile: PaypalSignatureHeaders = {
      ...headers,
      transmissionId: 'a","webhook_id":"forged',
    };
    const parsed = JSON.parse(verificationRequestBody(hostile, 'WH-REAL', '{"id":"WH-1"}'));
    expect(parsed.transmission_id).toBe('a","webhook_id":"forged');
    expect(parsed.webhook_id).toBe('WH-REAL');
  });

  it('produces valid JSON when headers are missing', () => {
    const empty: PaypalSignatureHeaders = {
      authAlgo: null,
      certUrl: null,
      transmissionId: null,
      transmissionSig: null,
      transmissionTime: null,
    };
    const parsed = JSON.parse(verificationRequestBody(empty, '', '{}'));
    expect(parsed.auth_algo).toBe('');
    expect(parsed.webhook_event).toEqual({});
  });
});

describe('approvalUrl', () => {
  it('finds the approve link among PayPal’s HATEOAS links', () => {
    const subscription = {
      id: 'I-1',
      links: [
        { rel: 'self', href: 'https://api-m.paypal.com/v1/billing/subscriptions/I-1' },
        { rel: 'approve', href: 'https://www.paypal.com/webapps/billing/subscriptions?ba_token=BA-1' },
      ],
    };
    expect(approvalUrl(subscription)).toBe(
      'https://www.paypal.com/webapps/billing/subscriptions?ba_token=BA-1',
    );
  });

  it('returns null when PayPal sent no approval link', () => {
    expect(approvalUrl({ id: 'I-1', links: [{ rel: 'self', href: 'https://x.test' }] })).toBeNull();
    expect(approvalUrl({ id: 'I-1' })).toBeNull();
    expect(approvalUrl({ links: 'not an array' })).toBeNull();
  });
});

/**
 * The setup script creates the PayPal plans that customers are actually
 * billed against, from its own copy of the price list. A price that matches
 * the pricing page everywhere except PayPal is a mistake that surfaces on
 * someone's bank statement, so the two copies are asserted to agree.
 */
describe('paypal-setup tiers', () => {
  it('charges what the pricing page says', () => {
    for (const tier of PAYPAL_TIERS) {
      const plan = PLANS[tier.plan as keyof typeof PLANS];
      expect(plan, tier.plan).toBeDefined();
      expect(plan.priceGbp, tier.plan).toBe(tier.priceGbp);
      expect(tier.label, tier.plan).toBe(plan.name);
    }
  });

  it('covers every paid plan and no others', () => {
    expect(PAYPAL_TIERS.map((t) => t.plan).sort()).toEqual(['pro', 'scale', 'starter']);
  });

  it('registers exactly the events the worker acts on', () => {
    // A webhook subscribed to fewer events than the worker handles activates
    // nobody; more events would be deliveries we always ignore.
    expect([...WEBHOOK_EVENTS].sort()).toEqual(
      [
        'BILLING.SUBSCRIPTION.ACTIVATED',
        'BILLING.SUBSCRIPTION.CANCELLED',
        'BILLING.SUBSCRIPTION.EXPIRED',
        'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
        'BILLING.SUBSCRIPTION.RE-ACTIVATED',
        'BILLING.SUBSCRIPTION.SUSPENDED',
        'BILLING.SUBSCRIPTION.UPDATED',
        'PAYMENT.SALE.COMPLETED',
      ].sort(),
    );
  });
});

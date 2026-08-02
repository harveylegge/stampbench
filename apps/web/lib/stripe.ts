import 'server-only';
import Stripe from 'stripe';
import { env, features } from './env';
import type { PlanId } from './plans';

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!features.billing || !env.stripeSecretKey) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
  }
  if (!client) client = new Stripe(env.stripeSecretKey);
  return client;
}

export function priceIdFor(plan: PlanId): string | undefined {
  if (plan === 'starter') return env.stripePrices.starter;
  if (plan === 'pro') return env.stripePrices.pro;
  if (plan === 'scale') return env.stripePrices.scale;
  return undefined;
}

/** Map a Stripe price id back to our plan id (used by the webhook). */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === env.stripePrices.starter) return 'starter';
  if (priceId === env.stripePrices.pro) return 'pro';
  if (priceId === env.stripePrices.scale) return 'scale';
  return null;
}

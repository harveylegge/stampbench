import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { env, features } from '@/lib/env';
import { stripe, priceIdFor } from '@/lib/stripe';
import type { PlanId } from '@/lib/plans';
import { apiError } from '@/lib/api';
import { log } from '@/lib/log';

export const runtime = 'nodejs';

/** POST /api/stripe/checkout  { plan: "starter" | "pro" | "scale" } */
export async function POST(request: Request) {
  if (!features.billing) {
    return apiError(503, 'billing_unavailable', 'Billing is not configured yet. Contact support.');
  }
  const user = await getCurrentUser();
  if (!user) return apiError(401, 'unauthenticated', 'Sign in first.');

  let plan: PlanId;
  try {
    const body = (await request.json()) as { plan?: string };
    if (!['starter', 'pro', 'scale'].includes(body.plan ?? '')) {
      return apiError(400, 'invalid_plan', 'plan must be starter, pro, or scale.');
    }
    plan = body.plan as PlanId;
  } catch {
    return apiError(400, 'invalid_json', 'Send {"plan": "starter"}.');
  }

  const priceId = priceIdFor(plan);
  if (!priceId) {
    return apiError(503, 'price_missing', `Stripe price for "${plan}" is not configured.`);
  }

  const s = stripe();
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await s.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  // Guard against duplicate subscriptions: Checkout in subscription mode always
  // creates a NEW subscription, so a user who already has one must change plans
  // through the billing portal, not a second checkout. Verify against Stripe
  // (source of truth) rather than our possibly-stale mirror.
  const existing = await s.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });
  const active = existing.data.find((sub) =>
    ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status),
  );
  if (active) {
    const portal = await s.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.appUrl}/dashboard/billing`,
    });
    return NextResponse.json({
      url: portal.url,
      note: 'You already have a subscription — manage or change your plan in the billing portal.',
    });
  }

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.appUrl}/dashboard/billing?success=1`,
    cancel_url: `${env.appUrl}/pricing`,
    metadata: { userId: user.id, plan },
  });

  log.info('billing.checkout_created', { userId: user.id, plan });
  return NextResponse.json({ url: session.url });
}

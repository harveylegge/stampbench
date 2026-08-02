import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { env, features } from '@/lib/env';
import { stripe, planForPriceId } from '@/lib/stripe';
import { log } from '@/lib/log';

export const runtime = 'nodejs';

async function setPlanByCustomer(customerId: string, plan: string, renewsAt?: Date | null, subscriptionId?: string | null) {
  const result = await db.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan,
      planRenewsAt: renewsAt ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
    },
  });
  if (result.count === 0) {
    log.warn('billing.webhook_unknown_customer', { customerId });
  }
}

/** POST /api/stripe/webhook — Stripe subscription lifecycle → plan sync. */
export async function POST(request: Request) {
  if (!features.billing || !env.stripeWebhookSecret) {
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
  } catch (e) {
    log.warn('billing.webhook_bad_signature', { message: (e as Error).message });
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const priceId = sub.items.data[0]?.price?.id;
        const plan = planForPriceId(priceId);
        const active = sub.status === 'active' || sub.status === 'trialing';
        const periodEnd = sub.items.data[0]?.current_period_end;
        if (plan && active) {
          await setPlanByCustomer(customerId, plan, periodEnd ? new Date(periodEnd * 1000) : null, sub.id);
        } else if (!active && (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired')) {
          await setPlanByCustomer(customerId, 'free');
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        await setPlanByCustomer(customerId, 'free');
        break;
      }
      default:
        break; // ignore events we don't care about
    }
  } catch (e) {
    log.error('billing.webhook_handler_error', { type: event.type, message: (e as Error).message });
    return NextResponse.json({ error: 'handler error' }, { status: 500 });
  }

  log.info('billing.webhook', { type: event.type });
  return NextResponse.json({ received: true });
}

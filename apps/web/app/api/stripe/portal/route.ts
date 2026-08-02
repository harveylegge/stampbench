import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { env, features } from '@/lib/env';
import { stripe } from '@/lib/stripe';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** POST /api/stripe/portal — open the Stripe customer portal. */
export async function POST() {
  if (!features.billing) {
    return apiError(503, 'billing_unavailable', 'Billing is not configured yet.');
  }
  const user = await getCurrentUser();
  if (!user) return apiError(401, 'unauthenticated', 'Sign in first.');
  if (!user.stripeCustomerId) {
    return apiError(400, 'no_customer', 'No billing profile yet — subscribe to a plan first.');
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.appUrl}/dashboard/billing`,
  });
  return NextResponse.json({ url: session.url });
}

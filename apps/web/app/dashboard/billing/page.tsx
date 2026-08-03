import { requireUser } from '@/lib/auth';
import { features } from '@/lib/env';
import { planFor, PLANS } from '@/lib/plans';
import { monthlyUsage } from '@/lib/usage';
import { BillingActions } from './billing-actions';

export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  const user = await requireUser();
  const plan = planFor(user.plan);
  const used = await monthlyUsage(user.id);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mb-8 text-sm text-muted">Manage your subscription.</p>

      <div className="mb-6 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm text-muted">Current plan</div>
            <div className="mt-1 text-xl font-semibold">{plan.name}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted">Usage</div>
            <div className="mt-1 font-mono text-sm">
              {used.toLocaleString()} / {plan.monthlyQuota.toLocaleString()} calls
            </div>
          </div>
        </div>
      </div>

      {!features.billing && (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          Billing is not configured on this deployment yet (Stripe keys missing). Plans below are
          shown for reference; upgrades activate once Stripe is connected.
        </div>
      )}

      <BillingActions
        currentPlan={plan.id}
        billingEnabled={features.billing}
        hasStripeCustomer={Boolean(user.stripeCustomerId)}
        plans={Object.values(PLANS).map((p) => ({
          id: p.id,
          name: p.name,
          priceGbp: p.priceGbp,
          monthlyQuota: p.monthlyQuota,
        }))}
      />
    </div>
  );
}

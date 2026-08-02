'use client';

import { useState } from 'react';

interface PlanRow {
  id: string;
  name: string;
  priceGbp: number;
  monthlyQuota: number;
}

export function BillingActions({
  currentPlan,
  billingEnabled,
  hasStripeCustomer,
  plans,
}: {
  currentPlan: string;
  billingEnabled: boolean;
  hasStripeCustomer: boolean;
  plans: PlanRow[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: string) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Checkout failed.');
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Could not open portal.');
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans
          .filter((p) => p.id !== 'free')
          .map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="font-mono text-sm text-muted">£{p.priceGbp}/mo</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                {p.monthlyQuota.toLocaleString()} API calls / month
              </div>
              <button
                onClick={() => checkout(p.id)}
                disabled={!billingEnabled || busy !== null || currentPlan === p.id}
                className="mt-4 w-full rounded-lg bg-accent py-2 text-sm font-medium text-white transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-40"
              >
                {currentPlan === p.id ? 'Current plan' : busy === p.id ? 'Redirecting…' : `Upgrade to ${p.name}`}
              </button>
            </div>
          ))}
      </div>

      {hasStripeCustomer && billingEnabled && (
        <button
          onClick={openPortal}
          disabled={busy !== null}
          className="mt-6 rounded-lg border border-border bg-surface px-4 py-2 text-sm transition hover:border-border-hi"
        >
          {busy === 'portal' ? 'Opening…' : 'Manage subscription / invoices'}
        </button>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}

import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { planFor } from '@/lib/plans';
import { monthlyUsage, usageByDay } from '@/lib/usage';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireUser();
  const plan = planFor(user.plan);
  const [used, daily, keyCount] = await Promise.all([
    monthlyUsage(user.id),
    usageByDay(user.id, 7),
    db.apiKey.count({ where: { userId: user.id, revokedAt: null } }),
  ]);

  const curl = `curl -s https://stampbench.com/api/v1/validate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/xml" \\
  --data-binary @invoice.xml`;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Overview</h1>
      <p className="mb-8 text-sm text-muted">Signed in as {user.email}</p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-muted">Plan</div>
          <div className="mt-1 text-xl font-semibold">{plan.name}</div>
          {plan.id === 'free' && (
            <Link href="/pricing" className="mt-2 inline-block text-sm text-accent-hi hover:underline">
              Upgrade →
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-muted">API calls this month</div>
          <div className="mt-1 text-xl font-semibold">
            {used.toLocaleString()}{' '}
            <span className="text-sm font-normal text-faint">/ {plan.monthlyQuota.toLocaleString()}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-muted">Active API keys</div>
          <div className="mt-1 text-xl font-semibold">{keyCount}</div>
          <Link href="/dashboard/keys" className="mt-2 inline-block text-sm text-accent-hi hover:underline">
            Manage keys →
          </Link>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-medium">Last 7 days</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint">
              <th className="pb-2 font-normal">Date</th>
              <th className="pb-2 text-right font-normal">API calls</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date} className="border-t border-border/60">
                <td className="py-1.5 font-mono text-muted">{d.date}</td>
                <td className="py-1.5 text-right">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-medium">Quickstart</h2>
        <p className="mb-3 text-sm text-muted">
          {keyCount === 0 ? (
            <>
              First, <Link href="/dashboard/keys" className="text-accent-hi hover:underline">create an API key</Link>, then:
            </>
          ) : (
            'Validate an XRechnung document from your terminal:'
          )}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs leading-relaxed text-muted">
          {curl}
        </pre>
        <p className="mt-3 text-sm text-muted">
          Full reference in the <Link href="/docs" className="text-accent-hi hover:underline">documentation</Link>.
        </p>
      </section>
    </div>
  );
}

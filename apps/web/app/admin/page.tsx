import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { currentPeriodStart } from '@/lib/plans';

export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const periodStart = currentPeriodStart();
  const [userCount, paidCount, monthEvents, users] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { plan: { not: 'free' } } }),
    db.usageEvent.count({ where: { createdAt: { gte: periodStart } } }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        plan: true,
        role: true,
        createdAt: true,
        _count: { select: { usageEvents: true, apiKeys: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mb-8 text-sm text-muted">Operational overview.</p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Users', value: userCount },
          { label: 'Paying customers', value: paidCount },
          { label: 'API calls this month', value: monthEvents },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="text-sm text-muted">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-faint">
            <tr>
              <th className="px-4 py-2.5 font-normal">Email</th>
              <th className="px-4 py-2.5 font-normal">Plan</th>
              <th className="px-4 py-2.5 font-normal">Keys</th>
              <th className="px-4 py-2.5 font-normal">Total calls</th>
              <th className="px-4 py-2.5 font-normal">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  {u.email}
                  {u.role === 'admin' && <span className="ml-2 text-xs text-accent-hi">admin</span>}
                </td>
                <td className="px-4 py-2.5 capitalize">{u.plan}</td>
                <td className="px-4 py-2.5">{u._count.apiKeys}</td>
                <td className="px-4 py-2.5">{u._count.usageEvents.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-muted">{u.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

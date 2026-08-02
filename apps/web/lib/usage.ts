import 'server-only';
import { db } from './db';
import { currentPeriodStart, planFor } from './plans';

export type UsageKind = 'validate' | 'generate' | 'ai_explain';

export async function monthlyUsage(userId: string): Promise<number> {
  return db.usageEvent.count({
    where: { userId, createdAt: { gte: currentPeriodStart() } },
  });
}

export async function checkQuota(userId: string, plan: string) {
  const p = planFor(plan);
  const used = await monthlyUsage(userId);
  return { allowed: used < p.monthlyQuota, used, quota: p.monthlyQuota, plan: p };
}

export async function recordUsage(
  userId: string,
  kind: UsageKind,
  opts: { apiKeyId?: string | null; profile?: string; ok?: boolean } = {},
): Promise<void> {
  await db.usageEvent.create({
    data: {
      userId,
      kind,
      apiKeyId: opts.apiKeyId ?? null,
      profile: opts.profile ?? null,
      ok: opts.ok ?? true,
    },
  });
}

/** Daily usage counts for the last `days` days — feeds the dashboard chart. */
export async function usageByDay(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await db.usageEvent.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true, kind: true },
    orderBy: { createdAt: 'asc' },
  });
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const day = e.createdAt.toISOString().slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

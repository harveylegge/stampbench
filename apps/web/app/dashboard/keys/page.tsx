import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { KeyManager } from './key-manager';

export const metadata = { title: 'API keys' };

export default async function KeysPage() {
  const user = await requireUser();
  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">API keys</h1>
      <p className="mb-8 text-sm text-muted">
        Send keys as <code className="font-mono text-accent-hi">Authorization: Bearer ig_live_…</code>.
        A key&apos;s full value is shown only once, at creation.
      </p>
      <KeyManager
        initialKeys={keys.map((k) => ({
          ...k,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

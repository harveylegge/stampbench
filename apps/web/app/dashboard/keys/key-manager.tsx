'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function KeyManager({ initialKeys }: { initialKeys: KeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || 'Default' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to create key.');
      setFreshKey({ key: data.key, name: data.name });
      setName('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this key? Requests using it will stop working immediately.')) return;
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  async function copy() {
    if (!freshKey) return;
    await navigator.clipboard.writeText(freshKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      {freshKey && (
        <div className="rounded-xl border border-accent/40 bg-accent-dim/40 p-4">
          <div className="mb-2 text-sm font-medium text-accent-hi">
            Key “{freshKey.name}” created — copy it now, it won&apos;t be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs">
              {freshKey.key}
            </code>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition hover:border-border-hi"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={createKey} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. production)"
          maxLength={60}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create key'}
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-faint">
            <tr>
              <th className="px-4 py-2.5 font-normal">Name</th>
              <th className="px-4 py-2.5 font-normal">Key</th>
              <th className="px-4 py-2.5 font-normal">Last used</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {initialKeys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No keys yet — create your first one above.
                </td>
              </tr>
            )}
            {initialKeys.map((k) => (
              <tr key={k.id} className="border-t border-border">
                <td className="px-4 py-2.5">{k.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{k.prefix}…</td>
                <td className="px-4 py-2.5 text-muted">
                  {/* ISO date slice is locale/timezone-stable, avoiding an SSR
                      hydration mismatch in this client component. */}
                  {k.lastUsedAt ? k.lastUsedAt.slice(0, 10) : 'Never'}
                </td>
                <td className="px-4 py-2.5">
                  {k.revokedAt ? (
                    <span className="text-faint">Revoked</span>
                  ) : (
                    <span className="text-success">Active</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {!k.revokedAt && (
                    <button
                      onClick={() => revoke(k.id)}
                      className="text-danger/80 transition hover:text-danger"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

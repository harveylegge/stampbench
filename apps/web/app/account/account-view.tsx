'use client';

/**
 * Account dashboard. The page itself is statically exported, so everything
 * here happens after mount: fetch the session from the worker, bounce
 * signed-out visitors to /signin, and render usage, API keys and the upgrade
 * cards. Upgrades are a request, not a checkout — no payment happens on the
 * site, so the copy says so plainly.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  ApiError,
  createKey,
  listKeys,
  logout,
  me,
  requestUpgrade,
  revokeKey,
  type ApiKeySummary,
  type Me,
} from '@/lib/account-client';
import { PLANS, type FeatureId, type PlanId } from '@/lib/plans';

const FEATURE_LABELS: Record<FeatureId, string> = {
  api: 'Hosted API calls',
  share: 'Shared reports',
  regress: 'Future-ruleset checks',
};
const FEATURE_ORDER: FeatureId[] = ['api', 'share', 'regress'];

type UpgradeId = Exclude<PlanId, 'free'>;
const UPGRADE_IDS: UpgradeId[] = ['starter', 'pro', 'scale'];

function isUpgradeId(v: string | null): v is UpgradeId {
  return v === 'starter' || v === 'pro' || v === 'scale';
}

/** ISO date slice — locale/timezone-stable, and quotas run on UTC anyway. */
function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const nf = (n: number) => n.toLocaleString('en-GB');

/** Quiet placeholder while the session check is in flight. */
function Skeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="mb-10 h-9 w-56 rounded-lg bg-surface-2" />
      <div className="mb-6 h-44 rounded-xl bg-surface-2" />
      <div className="mb-6 h-56 rounded-xl bg-surface-2" />
      <div className="h-72 rounded-xl bg-surface-2" />
    </div>
  );
}

export function AccountView() {
  const router = useRouter();
  const upgradeParam = useSearchParams().get('upgrade');

  const [account, setAccount] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // API keys
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [armedRevoke, setArmedRevoke] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Upgrade requests
  const [armedPlan, setArmedPlan] = useState<UpgradeId | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const cardRefs = useRef<Partial<Record<UpgradeId, HTMLDivElement | null>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const acct = await me();
        if (cancelled) return;
        if (!acct) {
          router.replace('/signin?next=/account');
          return;
        }
        setAccount(acct);
        const { keys: keyList } = await listKeys();
        if (!cancelled) setKeys(keyList);
      } catch {
        if (!cancelled) setLoadError('Could not load your account. Refresh to try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /* ?upgrade=starter|pro|scale (e.g. from a quota upsell) pre-arms a one-click
     confirm on the matching card and scrolls it into view — but never past a
     request that is already pending, and never for the plan already held. */
  useEffect(() => {
    if (!account || account.pendingUpgrade || !isUpgradeId(upgradeParam)) return;
    if (upgradeParam === account.plan) return;
    setArmedPlan(upgradeParam);
    requestAnimationFrame(() => {
      cardRefs.current[upgradeParam]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [account, upgradeParam]);

  /** Shared handling for actions that can outlive the session. */
  function apiMessage(e: unknown, fallback: string): string {
    if (e instanceof ApiError && e.code === 'unauthenticated') {
      router.replace('/signin?next=/account');
    }
    return e instanceof Error && e.message ? e.message : fallback;
  }

  async function signOut() {
    setBusy('signout');
    try {
      await logout();
    } catch {
      // Session already gone server-side — the destination is the same.
    }
    router.push('/');
  }

  async function onCreateKey() {
    setBusy('create');
    setKeyError(null);
    setCopied(false);
    try {
      const { key } = await createKey();
      setFreshKey(key);
      const { keys: keyList } = await listKeys();
      setKeys(keyList);
    } catch (e) {
      setKeyError(apiMessage(e, 'Could not create a key.'));
    } finally {
      setBusy(null);
    }
  }

  async function onRevoke(id: string) {
    setBusy(`revoke:${id}`);
    setKeyError(null);
    try {
      await revokeKey(id);
      setKeys((prev) => (prev ? prev.filter((k) => k.id !== id) : prev));
    } catch (e) {
      setKeyError(apiMessage(e, 'Could not revoke the key.'));
    } finally {
      setArmedRevoke(null);
      setBusy(null);
    }
  }

  async function onRequestUpgrade(plan: UpgradeId) {
    if (!account) return;
    setBusy(`upgrade:${plan}`);
    setUpgradeError(null);
    setArmedPlan(null);
    // Optimistic: show the pending notice immediately, roll back on failure.
    const previous = account;
    setAccount({ ...account, pendingUpgrade: plan });
    try {
      await requestUpgrade(plan);
    } catch (e) {
      setAccount(previous);
      setUpgradeError(apiMessage(e, 'Could not send the request. Try again, or email hello@stampbench.com.'));
    } finally {
      setBusy(null);
    }
  }

  async function copyFreshKey() {
    if (!freshKey) return;
    await navigator.clipboard.writeText(freshKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-sm text-danger">{loadError}</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Skeleton />
      </div>
    );
  }

  const plan = PLANS[account.plan] ?? PLANS.free;
  const pendingPlan = account.pendingUpgrade ? PLANS[account.pendingUpgrade] : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* ————— Header ————— */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {account.email}
            <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent-hi">
              {plan.name}
            </span>
          </p>
        </div>
        <button
          onClick={signOut}
          disabled={busy === 'signout'}
          className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:border-border-hi disabled:opacity-40"
        >
          {busy === 'signout' ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {/* ————— Usage ————— */}
      <section className="mb-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Usage this month</h2>
        <div className="flex flex-col gap-4">
          {FEATURE_ORDER.map((f) => {
            const u = account.usage[f];
            if (!u) return null;
            const unlimited = u.limit === -1;
            const pct = unlimited || u.limit <= 0 ? 0 : Math.min(100, (u.used / u.limit) * 100);
            return (
              <div key={f}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span>{FEATURE_LABELS[f]}</span>
                  <span className="font-mono text-xs text-muted">
                    {nf(u.used)} / {unlimited ? 'Unlimited' : nf(u.limit)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-faint">
          Quotas reset on the 1st of each month (UTC). Local validation with the library is never
          metered.
        </p>
      </section>

      {/* ————— API keys ————— */}
      <section className="mb-6 rounded-xl border border-border bg-surface p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">API keys</h2>
          <button
            onClick={onCreateKey}
            disabled={busy === 'create'}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-40"
          >
            {busy === 'create' ? 'Creating…' : 'Create key'}
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          Keys authenticate the hosted REST API — validate and generate from any language, metered
          against your plan.
        </p>

        {freshKey && (
          <div className="mb-4 rounded-lg border border-accent/40 bg-accent-dim/40 p-4">
            <div className="mb-2 text-sm font-medium text-accent-hi">
              Key created — copy it now, it will not be shown again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs">
                {freshKey}
              </code>
              <button
                onClick={copyFreshKey}
                className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition hover:border-border-hi"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {keyError && <p className="mb-4 text-sm text-danger">{keyError}</p>}

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2/60 text-left text-faint">
              <tr>
                <th className="px-4 py-2.5 font-normal">Key</th>
                <th className="px-4 py-2.5 font-normal">Created</th>
                <th className="px-4 py-2.5 font-normal">Last used</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {keys === null && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-faint">
                    Loading keys…
                  </td>
                </tr>
              )}
              {keys?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    No keys yet — create your first one above.
                  </td>
                </tr>
              )}
              {keys?.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{k.prefix}…</td>
                  <td className="px-4 py-2.5 text-muted">{isoDay(k.createdAt)}</td>
                  <td className="px-4 py-2.5 text-muted">{k.lastUsed ? isoDay(k.lastUsed) : 'never'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {armedRevoke === k.id ? (
                      <span className="inline-flex items-center gap-3">
                        <button
                          onClick={() => onRevoke(k.id)}
                          disabled={busy === `revoke:${k.id}`}
                          className="font-medium text-danger transition hover:underline disabled:opacity-40"
                        >
                          {busy === `revoke:${k.id}` ? 'Revoking…' : 'Confirm revoke'}
                        </button>
                        <button
                          onClick={() => setArmedRevoke(null)}
                          className="text-faint transition hover:text-text"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setArmedRevoke(k.id)}
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

        <div className="mt-4">
          <div className="mb-1.5 text-xs text-faint">
            Send a document from any shell (PowerShell: use <code className="font-mono">curl.exe</code>):
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-muted">
            {`curl -X POST https://stampbench.com/api/v1/validate \\
  -H "Authorization: Bearer YOUR_KEY" \\
  --data-binary @invoice.xml`}
          </pre>
        </div>
      </section>

      {/* ————— Upgrade ————— */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Upgrade</h2>
        <p className="mb-4 text-sm text-muted">
          No card is taken on the site. We email you, arrange payment, and activate the plan —
          usually within a day.
        </p>

        {upgradeError && <p className="mb-4 text-sm text-danger">{upgradeError}</p>}

        {pendingPlan && (
          <div className="mb-4 rounded-lg border border-accent/40 bg-accent-dim/40 p-4 text-sm text-accent-hi">
            Upgrade to {pendingPlan.name} requested — we will email you to arrange payment and
            activation.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {UPGRADE_IDS.map((id) => {
            const p = PLANS[id];
            const isCurrent = id === account.plan;
            const armed = armedPlan === id && !pendingPlan;
            return (
              <div
                key={id}
                ref={(el) => {
                  cardRefs.current[id] = el;
                }}
                className={`flex flex-col rounded-xl border p-5 ${
                  armed ? 'border-accent bg-accent-dim/20' : 'border-border bg-bg'
                }`}
              >
                <div className="mb-1 font-medium">{p.name}</div>
                <div className="mb-4">
                  <span className="text-2xl font-semibold">£{p.priceGbp}</span>
                  <span className="text-sm text-muted">/month</span>
                </div>
                <ul className="mb-5 flex flex-col gap-2 text-sm text-muted">
                  {p.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-success">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {pendingPlan ? null : isCurrent ? (
                  <div className="mt-auto rounded-lg border border-border py-1.5 text-center text-sm text-faint">
                    Current plan
                  </div>
                ) : armed ? (
                  <div className="mt-auto flex flex-col gap-2">
                    <button
                      onClick={() => onRequestUpgrade(id)}
                      disabled={busy === `upgrade:${id}`}
                      className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-40"
                    >
                      {busy === `upgrade:${id}` ? 'Sending…' : `Confirm ${p.name} request`}
                    </button>
                    <button
                      onClick={() => setArmedPlan(null)}
                      className="text-xs text-faint transition hover:text-text"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onRequestUpgrade(id)}
                    disabled={busy?.startsWith('upgrade:') ?? false}
                    className="mt-auto rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm font-medium transition hover:border-border-hi disabled:opacity-40"
                  >
                    {busy === `upgrade:${id}` ? 'Sending…' : `Request ${p.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

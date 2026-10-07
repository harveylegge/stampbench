'use client';

/**
 * Account dashboard. The page itself is statically exported, so everything
 * here happens after mount: fetch the session from the worker, bounce
 * signed-out visitors to /signin, and render usage, API keys, billing and the
 * data controls.
 *
 * Upgrades take one of three paths depending on what the server reports under
 * `billing`: Stripe Checkout when card payment is configured, a PayPal
 * subscription when that is, and the original email-us request when neither
 * is. The copy follows the path actually available, so the page never promises
 * a checkout that would 503.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  ApiError,
  billingPortal,
  cancelPaypalSubscription,
  cancelUpgradeRequest,
  createKey,
  createPaymentHook,
  deleteAccount,
  deletePaymentHook,
  exportAccount,
  listKeys,
  logout,
  me,
  paymentHookStatus,
  requestUpgrade,
  revokeKey,
  startCheckout,
  startPaypalSubscription,
  type ApiKeySummary,
  type Me,
} from '@/lib/account-client';
import { entitlementsFor } from '@/lib/entitlements';
import { PLANS, type FeatureId, type PlanId } from '@/lib/plans';

const FEATURE_LABELS: Record<FeatureId, string> = {
  api: 'Hosted API calls',
  share: 'Shared reports',
  regress: 'Future-ruleset checks',
  ai: 'AI explanations',
};
const FEATURE_ORDER: FeatureId[] = ['api', 'share', 'regress'];

type UpgradeId = Exclude<PlanId, 'free'>;
const UPGRADE_IDS: UpgradeId[] = ['starter', 'pro', 'scale'];

function isUpgradeId(v: string | null): v is UpgradeId {
  return v === 'starter' || v === 'pro' || v === 'scale';
}

/** ISO date slice: locale/timezone-stable, and quotas run on UTC anyway. */
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
  const params = useSearchParams();
  const upgradeParam = params.get('upgrade');
  /** Set by PayPal's return_url: the buyer approved and is on their way back. */
  const returnedFromPaypal = params.get('subscribed') === 'paypal';

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
  /** PayPal link for the plan just requested, when PayPal is configured. */
  const [payUrl, setPayUrl] = useState<string | null>(null);
  /** True while waiting for PayPal's webhook to activate a just-approved plan. */
  const [activating, setActivating] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const pollStarted = useRef(false);

  // Payment hook (auto-invoicing)
  const [hookConfigured, setHookConfigured] = useState<boolean | null>(null);
  const [hookUrl, setHookUrl] = useState<string | null>(null);
  const [hookCopied, setHookCopied] = useState(false);
  const [hookArmed, setHookArmed] = useState<'rotate' | 'remove' | null>(null);
  const [hookError, setHookError] = useState<string | null>(null);

  // Data controls (GDPR export / erasure)
  const [dataError, setDataError] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

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
        // Separate catch: a hiccup here should not blank the whole page: and
        // must NOT be read as "no hook", or one un-confirmed click would
        // overwrite a live webhook. Leave the state unknown and say so.
        try {
          const { configured } = await paymentHookStatus();
          if (!cancelled) setHookConfigured(configured);
        } catch {
          if (!cancelled) {
            setHookConfigured(null);
            setHookError('Could not check your webhook status: refresh to try again.');
          }
        }
      } catch {
        // The production account API is supplied by the Cloudflare worker and
        // does not exist inside `next dev`. Keep the localhost design preview
        // usable without weakening the production authentication boundary.
        if (!cancelled && window.location.hostname === 'localhost') {
          setAccount({
            email: 'hello@stampbench.com',
            plan: 'free',
            createdAt: Date.now(),
            usage: {
              api: { used: 0, limit: 100 },
              share: { used: 0, limit: 10 },
              regress: { used: 0, limit: 5 },
              ai: { used: 0, limit: 5 },
            },
            pendingUpgrade: null,
            billing: {
              enabled: false,
              subscribed: false,
              hasCustomer: false,
              paypalSubscriptions: false,
              paypalSubscribed: false,
            },
          });
          setKeys([]);
          setHookConfigured(false);
          setLoadError(null);
        } else if (!cancelled) {
          setLoadError('Could not load your account. Refresh to try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /* ?upgrade=starter|pro|scale (e.g. from a quota upsell) pre-arms a one-click
     confirm on the matching card and scrolls it into view: never for the plan
     already held. A pending manual request only blocks this in the manual
     world: once self-serve billing exists, the pending note is history, not a
     gate, and the person who already asked for a plan is the last person the
     buttons should hide from. */
  useEffect(() => {
    if (!account || !isUpgradeId(upgradeParam)) return;
    const selfServeNow = account.billing.enabled || account.billing.paypalSubscriptions;
    if (account.pendingUpgrade && !selfServeNow) return;
    if (upgradeParam === account.plan) return;
    setArmedPlan(upgradeParam);
    requestAnimationFrame(() => {
      cardRefs.current[upgradeParam]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [account, upgradeParam]);

  /* Coming back from PayPal's approval page, the plan is usually not live yet:
     the browser is racing a webhook. Rather than showing the old plan (which
     reads as "my payment did nothing"), poll for the entitlement the webhook
     grants. Polling, not trusting the return URL: that URL is a navigation
     anyone can perform, and it is not evidence that anything was paid. */
  useEffect(() => {
    if (!returnedFromPaypal || !account || pollStarted.current) return;
    if (account.billing.paypalSubscribed) return;
    pollStarted.current = true;
    setActivating(true);

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      attempts += 1;
      try {
        const fresh = await me();
        if (cancelled) return;
        if (fresh) {
          setAccount(fresh);
          if (fresh.billing.paypalSubscribed) {
            setActivating(false);
            return;
          }
        }
      } catch {
        // Transient failure: keep waiting; the attempt cap ends this anyway.
      }
      if (cancelled) return;
      // ~30s in total. Past that it is more honest to stop spinning and tell
      // someone what to do than to imply we are still making progress.
      if (attempts >= 10) {
        setActivating(false);
        return;
      }
      timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [returnedFromPaypal, account]);

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
      // Session already gone server-side: the destination is the same.
    }
    // Drop the assistant transcript so the next person on this browser cannot
    // read the previous user's conversation, and hard-navigate so every piece
    // of cached client state (the memoised plan, the widget) resets cleanly.
    try {
      window.sessionStorage.removeItem('sb_assistant_chat');
    } catch {
      // storage unavailable: nothing to clear
    }
    window.location.assign('/');
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

  /** Create or rotate the payment hook. The URL shows exactly once. */
  async function onCreateHook() {
    setBusy('hook:create');
    setHookError(null);
    setHookCopied(false);
    try {
      const { url } = await createPaymentHook();
      setHookUrl(url);
      setHookConfigured(true);
    } catch (e) {
      setHookError(apiMessage(e, 'Could not set up the webhook.'));
    } finally {
      setHookArmed(null);
      setBusy(null);
    }
  }

  async function onRemoveHook() {
    setBusy('hook:remove');
    setHookError(null);
    try {
      await deletePaymentHook();
      setHookConfigured(false);
      setHookUrl(null);
    } catch (e) {
      setHookError(apiMessage(e, 'Could not remove the webhook.'));
    } finally {
      setHookArmed(null);
      setBusy(null);
    }
  }

  /**
   * Card path. Deliberately does **not** touch local plan state: the account
   * is upgraded when Stripe's signed webhook lands, not when the browser
   * navigates. Showing the new plan optimistically here would display a paid
   * tier to someone who then abandons the payment form.
   */
  async function onCheckout(plan: UpgradeId) {
    setBusy(`upgrade:${plan}`);
    setUpgradeError(null);
    setArmedPlan(null);
    try {
      const { url } = await startCheckout(plan);
      if (!url) throw new Error('No checkout URL returned.');
      window.location.assign(url);
    } catch (e) {
      setUpgradeError(apiMessage(e, 'Could not start checkout. Try again, or email hello@stampbench.com.'));
      setBusy(null);
    }
    // No `finally`: on success the page is navigating away, and clearing the
    // busy flag would flash the button back to idle mid-redirect.
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
      const { payUrl } = await requestUpgrade(plan);
      // When PayPal is configured the wait collapses: pay now rather than
      // waiting for an email. The plan still activates only once a human
      // confirms the money arrived, which the notice says plainly.
      setPayUrl(payUrl ?? null);
    } catch (e) {
      setAccount(previous);
      setPayUrl(null);
      setUpgradeError(apiMessage(e, 'Could not send the request. Try again, or email hello@stampbench.com.'));
    } finally {
      setBusy(null);
    }
  }

  /**
   * PayPal's recurring path. Same discipline as `onCheckout`: this only sends
   * the browser to PayPal. The plan changes when the verified webhook says the
   * subscription activated.
   */
  async function onPaypalSubscribe(plan: UpgradeId) {
    setBusy(`upgrade:${plan}`);
    setUpgradeError(null);
    setArmedPlan(null);
    try {
      const { url } = await startPaypalSubscription(plan);
      if (!url) throw new Error('No approval URL returned.');
      window.location.assign(url);
    } catch (e) {
      setUpgradeError(apiMessage(e, 'Could not start the PayPal subscription. Try again, or email hello@stampbench.com.'));
      setBusy(null);
    }
    // No `finally`: the page is navigating away on success.
  }

  /**
   * Route to whichever upgrade mechanism the server actually has available.
   *
   * Cards first when both exist: instant activation and a hosted portal beat
   * PayPal's approval hop. PayPal subscriptions next, because they recur.
   * The email loop last: it always works, and it always needs a human.
   */
  function onUpgrade(plan: UpgradeId) {
    if (account?.billing.enabled) void onCheckout(plan);
    else if (account?.billing.paypalSubscriptions) void onPaypalSubscribe(plan);
    else void onRequestUpgrade(plan);
  }

  async function onCancelPaypal() {
    setBusy('cancel-paypal');
    setUpgradeError(null);
    try {
      await cancelPaypalSubscription();
      const fresh = await me();
      if (fresh) setAccount(fresh);
    } catch (e) {
      setUpgradeError(
        apiMessage(e, 'Could not cancel with PayPal. Try again, or cancel under Automatic Payments in your PayPal account.'),
      );
    } finally {
      setCancelArmed(false);
      setBusy(null);
    }
  }

  async function onManageBilling() {
    setBusy('portal');
    setUpgradeError(null);
    try {
      const { url } = await billingPortal();
      if (!url) throw new Error('No portal URL returned.');
      window.location.assign(url);
    } catch (e) {
      setUpgradeError(apiMessage(e, 'Could not open the billing portal.'));
      setBusy(null);
    }
  }

  async function onExportData() {
    setBusy('export');
    setDataError(null);
    try {
      const data = await exportAccount();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stampbench-account-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDataError(apiMessage(e, 'Could not export your data.'));
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteAccount() {
    setBusy('delete');
    setDataError(null);
    try {
      await deleteAccount(deleteConfirm.trim());
      // Everything is gone, including the session: a hard navigation avoids
      // rendering a dashboard for an account that no longer exists.
      window.location.assign('/?deleted=1');
    } catch (e) {
      setDataError(apiMessage(e, 'Could not delete the account.'));
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

  /* Button wording follows the mechanism actually in use: "Subscribe to X"
     promises a checkout, "Request X" promises an email. Saying the wrong one
     is a small lie that costs trust at exactly the moment someone is deciding
     whether to hand over a card. */
  const selfServe = account.billing.enabled || account.billing.paypalSubscriptions;
  const cardCopy = selfServe
    ? { idle: 'Subscribe to', confirm: 'Continue to payment: ', busy: 'Redirecting…' }
    : { idle: 'Request', confirm: 'Confirm request for', busy: 'Sending…' };

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* -------------------------------- Header -------------------------------- */}
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

      {/* -------------------------------- Usage -------------------------------- */}
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

      {/* -------------------------------- API keys -------------------------------- */}
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
          Keys authenticate the hosted REST API: validate and generate from any language, metered
          against your plan.
        </p>

        {freshKey && (
          <div className="mb-4 rounded-lg border border-accent/40 bg-accent-dim/40 p-4">
            <div className="mb-2 text-sm font-medium text-accent-hi">
              Key created: copy it now, it will not be shown again.
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
                    No keys yet: create your first one above.
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

      {/* -------------------------------- Upgrade -------------------------------- */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">
          {account.billing.subscribed || account.billing.paypalSubscribed ? 'Plan & billing' : 'Upgrade'}
        </h2>
        <p className="mb-4 text-sm text-muted">
          {account.billing.enabled
            ? 'Pay by card through Stripe: your plan activates as soon as the payment clears. Cancel any time from the billing portal.'
            : account.billing.paypalSubscriptions
              ? 'Subscribe with PayPal: it renews monthly and your plan activates as soon as PayPal confirms the first payment. Cancel any time, right here.'
              : 'No card is taken on the site. We email you, arrange payment, and activate the plan: usually within a day.'}
        </p>

        {(account.billing.subscribed || account.billing.hasCustomer) && (
          <button
            onClick={onManageBilling}
            disabled={busy === 'portal'}
            className="mb-4 rounded-lg border border-border bg-bg px-3.5 py-1.5 text-sm font-medium transition hover:border-border-hi disabled:opacity-40"
          >
            {busy === 'portal' ? 'Opening…' : 'Manage billing, invoices & cancellation'}
          </button>
        )}

        {/* PayPal has no hosted portal, so cancellation lives here. Two clicks:
            this ends a paid plan, and a mis-click should not do that. */}
        {account.billing.paypalSubscribed && (
          <div className="mb-4">
            {cancelArmed ? (
              <div className="rounded-lg border border-border bg-bg p-4">
                <p className="text-sm">
                  Cancel your PayPal subscription? Your plan drops to Free and PayPal stops billing
                  you. Nothing else on the account changes: your keys, reports and usage stay.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={onCancelPaypal}
                    disabled={busy === 'cancel-paypal'}
                    className="rounded-lg border border-danger/50 px-3.5 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/5 disabled:opacity-40"
                  >
                    {busy === 'cancel-paypal' ? 'Cancelling…' : 'Yes, cancel my subscription'}
                  </button>
                  <button
                    onClick={() => setCancelArmed(false)}
                    className="rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium transition hover:border-border-hi"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCancelArmed(true)}
                className="rounded-lg border border-border bg-bg px-3.5 py-1.5 text-sm font-medium transition hover:border-border-hi"
              >
                Cancel PayPal subscription
              </button>
            )}
          </div>
        )}

        {/* The gap between PayPal's redirect and its webhook. Saying nothing
            here reads as "my payment did nothing". */}
        {activating && (
          <p className="mb-4 rounded-lg border border-accent/40 bg-accent-dim/40 p-4 text-sm text-accent-hi">
            PayPal approved: waiting for confirmation. This usually takes a few seconds; the page
            updates on its own.
          </p>
        )}
        {returnedFromPaypal && !activating && !account.billing.paypalSubscribed && (
          <p className="mb-4 rounded-lg border border-border bg-bg p-4 text-sm text-muted">
            PayPal has not confirmed the subscription yet. If you completed payment, refresh in a
            minute: and if it still is not live, email hello@stampbench.com and we will sort it out
            by hand.
          </p>
        )}

        {upgradeError && <p className="mb-4 text-sm text-danger">{upgradeError}</p>}

        {/* A pending manual request, in a world where self-serve now exists:
            say the request is remembered, point at the faster path, and offer
            a way to withdraw it. Subscribing also clears it server-side the
            moment the webhook lands, so nobody is ever asked to tidy up after
            paying. */}
        {pendingPlan && selfServe && (
          <div className="mb-4 rounded-lg border border-accent/40 bg-accent-dim/40 p-4 text-sm">
            <p className="font-medium text-accent-hi">
              You requested {pendingPlan.name} earlier, when activation was done by hand.
            </p>
            <p className="mt-1 text-muted">
              Good news since then: you can now activate it yourself, instantly: use the{' '}
              <span className="font-medium text-text">Subscribe to {pendingPlan.name}</span> button
              below. Subscribing replaces the old request automatically.
            </p>
            <button
              onClick={async () => {
                try {
                  await cancelUpgradeRequest();
                  setAccount({ ...account, pendingUpgrade: null });
                } catch {
                  // The note stays; nothing was lost. Next visit tries again.
                }
              }}
              className="mt-2 text-xs text-faint underline transition hover:text-text"
            >
              Or dismiss the old request
            </button>
          </div>
        )}

        {pendingPlan && !selfServe && (
          <div className="mb-4 rounded-lg border border-accent/40 bg-accent-dim/40 p-4 text-sm">
            {payUrl ? (
              <>
                <p className="font-medium text-accent-hi">
                  Upgrade to {pendingPlan.name} requested: £{pendingPlan.priceGbp}/month.
                </p>
                <p className="mt-1 text-muted">
                  Pay by PayPal and we will switch your plan on as soon as it lands, usually the
                  same day. Paying does not activate it automatically: a person checks the payment
                  first, and we will email you the moment it is live.
                </p>
                <a
                  href={payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sb-press mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-hi"
                >
                  Pay £{pendingPlan.priceGbp} with PayPal ↗
                </a>
              </>
            ) : (
              <p className="text-accent-hi">
                Upgrade to {pendingPlan.name} requested: we will email you to arrange payment and
                activation.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {UPGRADE_IDS.map((id) => {
            const p = PLANS[id];
            const isCurrent = id === account.plan;
            // A pending manual request only suppresses the buttons while
            // manual is the only mechanism. With self-serve on, hiding the
            // subscribe button from the one person who already asked to pay
            // would be the deadlock this section used to have.
            const blockedByPending = Boolean(pendingPlan) && !selfServe;
            const armed = armedPlan === id && !blockedByPending;
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
                {blockedByPending ? null : isCurrent ? (
                  <div className="mt-auto rounded-lg border border-border py-1.5 text-center text-sm text-faint">
                    Current plan
                  </div>
                ) : armed ? (
                  <div className="mt-auto flex flex-col gap-2">
                    <button
                      onClick={() => onUpgrade(id)}
                      disabled={busy === `upgrade:${id}`}
                      className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-40"
                    >
                      {busy === `upgrade:${id}`
                        ? cardCopy.busy
                        : `${cardCopy.confirm} ${p.name}`}
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
                    onClick={() => onUpgrade(id)}
                    disabled={busy?.startsWith('upgrade:') ?? false}
                    className="mt-auto rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm font-medium transition hover:border-border-hi disabled:opacity-40"
                  >
                    {busy === `upgrade:${id}` ? cardCopy.busy : `${cardCopy.idle} ${p.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* -------------------------------- Invoice Autopilot: account-only product preview -------------------------------- */}
      <section className="account-autopilot" aria-labelledby="invoice-autopilot-title">
        <div className="autopilot-head">
          <div>
            <p className="autopilot-kicker"><i />INVOICE AUTOPILOT / EARLY ACCESS</p>
            <h2 id="invoice-autopilot-title">
              Put your invoicing<br /><em>on autopilot.</em>
            </h2>
          </div>
          <p>Five small setup steps. After that, routine invoices can prepare themselves and only exceptions come back to you.</p>
        </div>

        <figure className="autopilot-flipbook">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/invoice-autopilot-flipbook.png"
            alt="Four illustrated steps showing an order email becoming a checked invoice, followed by reminders and a human review flag"
          />
          <figcaption>FROM THE LATEST LABELLED EMAIL → TO A READY, CHECKED INVOICE</figcaption>
        </figure>

        <ol className="autopilot-steps">
          <li><b>01</b><strong>Make one Gmail label</strong><span>In Gmail, create a label called “Stampbench”. Add a filter so order emails from chosen customers receive it.</span></li>
          <li><b>02</b><strong>Connect that label</strong><span>When early access is enabled, click Connect Gmail, sign in with Google, then choose only the Stampbench label.</span></li>
          <li><b>03</b><strong>Add your invoice rules</strong><span>Choose your business details, prices, payment terms and the address invoices should be sent from.</span></li>
          <li><b>04</b><strong>Approve the first draft</strong><span>Stampbench reads the newest labelled email and prepares an invoice. Check it once and approve the customer.</span></li>
          <li><b>05</b><strong>Switch on reminders</strong><span>Choose the due date and up to three reminder dates. After the last reminder, it returns to you for a manual decision.</span></li>
        </ol>

        <div className="autopilot-foot">
          <div>
            <strong>Your inbox stays yours.</strong>
            <p>
              When enabled, Stampbench will fetch only messages carrying the Gmail label you
              choose. Other mail is not processed, and nothing sends until your rules allow it.
            </p>
          </div>
          <a href="mailto:hello@stampbench.com?subject=Invoice%20Autopilot%20early%20access">
            Join early access <span>↗</span>
          </a>
        </div>
      </section>

      {/* -------------------------------- Payment matching (inbound payment webhook) -------------------------------- */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Payment matching</h2>
        <p className="mb-4 text-sm text-muted">
          A secret webhook URL for your account. Point PayPal, Stripe or anything that can send
          JSON at it, and an incoming payment marks the matching invoice paid: or creates a draft
          invoice for you when nothing matches. New invoices appear in{' '}
          <a href="/my-invoices" className="text-accent-hi hover:underline">My invoices</a> the next
          time it syncs. See the{' '}
          <a href="/docs#payment-webhook" className="text-accent-hi hover:underline">
            webhook documentation
          </a>{' '}
          for the payload it accepts.
        </p>

        {hookError && <p className="mb-4 text-sm text-danger">{hookError}</p>}

        {!entitlementsFor(account.plan).autoInvoicing ? (
          <div className="rounded-lg border border-accent/40 bg-accent-dim/40 p-4 text-sm">
            Payment matching is part of paid plans.{' '}
            <button
              onClick={() => {
                setArmedPlan('starter');
                requestAnimationFrame(() => {
                  cardRefs.current.starter?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
              }}
              className="font-medium text-accent-hi hover:underline"
            >
              See plans
            </button>
          </div>
        ) : (
          <>
            {hookUrl && (
              <div className="mb-4 rounded-lg border border-accent/40 bg-accent-dim/40 p-4">
                <p className="mb-2 text-sm">
                  Your webhook URL: copy it now, it is shown only this once:
                </p>
                <code className="block overflow-x-auto rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs">
                  {hookUrl}
                </code>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(hookUrl).then(() => setHookCopied(true));
                  }}
                  className="mt-2 rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:border-border-hi"
                >
                  {hookCopied ? 'Copied ✓' : 'Copy URL'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {hookConfigured === false && (
                <button
                  onClick={onCreateHook}
                  disabled={busy === 'hook:create'}
                  className="sb-press rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-40"
                >
                  {busy === 'hook:create' ? 'Setting up…' : 'Set up the webhook'}
                </button>
              )}
              {hookConfigured === true && !hookArmed && (
                <>
                  <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent-hi">
                    Active
                  </span>
                  <button
                    onClick={() => setHookArmed('rotate')}
                    className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:border-border-hi"
                  >
                    Rotate URL
                  </button>
                  <button
                    onClick={() => setHookArmed('remove')}
                    className="rounded-lg border border-danger/40 px-3.5 py-1.5 text-sm text-danger transition hover:border-danger"
                  >
                    Remove
                  </button>
                </>
              )}
              {hookConfigured === true && hookArmed && (
                <>
                  <span className="text-sm text-muted">
                    {hookArmed === 'rotate'
                      ? 'Rotating stops the current URL working immediately.'
                      : 'Removing stops all deliveries: invoices already created stay.'}
                  </span>
                  <button
                    onClick={hookArmed === 'rotate' ? onCreateHook : onRemoveHook}
                    disabled={busy === 'hook:create' || busy === 'hook:remove'}
                    className="rounded-lg bg-danger px-3.5 py-1.5 text-sm font-medium text-white transition disabled:opacity-40"
                  >
                    {busy ? 'Working…' : hookArmed === 'rotate' ? 'Rotate now' : 'Remove now'}
                  </button>
                  <button
                    onClick={() => setHookArmed(null)}
                    className="rounded-lg border border-border px-3.5 py-1.5 text-sm transition hover:border-border-hi"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {/* -------------------------------- Your data (GDPR Art. 15/17/20) -------------------------------- */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Your data</h2>
        <p className="mb-4 text-sm text-muted">
          Take a copy of everything we hold about this account, or delete it permanently. Invoice
          XML is never stored: only your account, usage counts and any reports you chose to share.
        </p>

        {dataError && <p className="mb-4 text-sm text-danger">{dataError}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExportData}
            disabled={busy === 'export'}
            className="rounded-lg border border-border bg-bg px-3.5 py-1.5 text-sm font-medium transition hover:border-border-hi disabled:opacity-40"
          >
            {busy === 'export' ? 'Preparing…' : 'Download my data (JSON)'}
          </button>
          {!deleteArmed && (
            <button
              onClick={() => setDeleteArmed(true)}
              className="rounded-lg border border-danger/40 px-3.5 py-1.5 text-sm font-medium text-danger transition hover:border-danger"
            >
              Delete my account
            </button>
          )}
        </div>

        {deleteArmed && (
          <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 p-4">
            <p className="text-sm">
              This permanently deletes your account, API keys, usage history and shared reports.
              {(account.billing.subscribed || account.billing.paypalSubscribed) &&
                ' Your subscription is cancelled at the same time.'}{' '}
              It cannot be undone.
            </p>
            <label className="mt-3 block text-xs text-muted" htmlFor="delete-confirm">
              Type <span className="font-mono text-text">{account.email}</span> to confirm
            </label>
            <input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full max-w-sm rounded-lg border border-border bg-bg px-3 py-1.5 font-mono text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onDeleteAccount}
                disabled={busy === 'delete' || deleteConfirm.trim() !== account.email}
                className="rounded-lg bg-danger px-3.5 py-1.5 text-sm font-medium text-white transition disabled:opacity-40"
              >
                {busy === 'delete' ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                onClick={() => {
                  setDeleteArmed(false);
                  setDeleteConfirm('');
                  setDataError(null);
                }}
                className="rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium transition hover:border-border-hi"
              >
                Keep my account
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

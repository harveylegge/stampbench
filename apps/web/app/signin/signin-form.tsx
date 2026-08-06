'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, login, me } from '@/lib/account-client';

const INPUT_CLASS =
  'rounded-lg border border-border bg-bg px-3 py-2 outline-none transition focus:border-accent';

export function SigninForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?next= lets gated pages bounce back after sign-in. Same-site paths only —
  // a leading '/' but not '//', so it can never become an off-site redirect.
  const next = searchParams.get('next');
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    let cancelled = false;
    me()
      .then((user) => {
        if (user && !cancelled) router.replace(destination);
      })
      .catch(() => {
        // API unreachable — leave the form usable; submitting will surface it.
      });
    return () => {
      cancelled = true;
    };
  }, [router, destination]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.push(destination);
      // `busy` stays true — the router is navigating away.
    } catch (err) {
      if (err instanceof ApiError && err.code === 'bad_credentials') {
        // Deliberately neutral: no hint about which half was wrong.
        setError('That email and password combination did not work.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      }
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-8 text-sm text-muted">Welcome back.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={INPUT_CLASS}
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-xs text-faint">
        Forgot password? Email{' '}
        <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
          hello@stampbench.com
        </a>{' '}
        and we will sort it out manually — automated reset is coming.
      </p>
      <p className="mt-4 text-sm text-muted">
        No account yet?{' '}
        <Link href="/signup" className="text-accent-hi hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

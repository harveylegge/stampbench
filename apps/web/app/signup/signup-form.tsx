'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, me, register } from '@/lib/account-client';

/** Deliberately loose — the worker verifies properly; this only catches typos. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INPUT_CLASS =
  'rounded-lg border border-border bg-bg px-3 py-2 outline-none transition focus:border-accent';

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Arriving from pricing carries ?plan= through to /account so the upgrade
  // request can continue where the visitor left off.
  const plan = searchParams.get('plan');
  const destination = plan ? `/account?upgrade=${encodeURIComponent(plan)}` : '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? The account page is where they meant to go.
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
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!EMAIL_SHAPE.test(email.trim())) errors.email = 'That does not look like an email address.';
    if (password.length < 10) errors.password = 'Password must be at least 10 characters.';
    if (password !== confirm) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      await register(email.trim(), password);
      router.push(destination);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') {
        setFormError(
          <>
            An account with this email already exists.{' '}
            <Link href="/signin" className="text-accent-hi hover:underline">
              Sign in instead
            </Link>
            .
          </>,
        );
      } else if (err instanceof ApiError && err.code === 'weak_password') {
        setFieldErrors({ password: err.message });
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      }
      setBusy(false);
    }
    // On success `busy` stays true — the router is navigating away.
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="mb-8 text-sm text-muted">No card required. Delete it whenever you like.</p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
          {fieldErrors.email && <span className="text-danger">{fieldErrors.email}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Password (10+ characters)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={10}
            className={INPUT_CLASS}
          />
          {fieldErrors.password && <span className="text-danger">{fieldErrors.password}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className={INPUT_CLASS}
          />
          {fieldErrors.confirm && <span className="text-danger">{fieldErrors.confirm}</span>}
        </label>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-xs text-faint">
        Free plan: 100 hosted API calls, 10 shared reports and 5 future-ruleset checks per month.
        The open-source library needs no account and is unlimited.
      </p>
      <p className="mt-4 text-sm text-muted">
        Already have an account?{' '}
        <Link href="/signin" className="text-accent-hi hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

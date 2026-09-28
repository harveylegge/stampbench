'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { registerAction, type AuthFormState } from '../actions';

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(registerAction, {});
  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-24">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-8 text-sm text-muted">
        Free plan: 100 API calls a month, no card required.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Name (optional)</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none transition focus:border-accent"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input name="termsAccepted" value="yes" type="checkbox" required className="mt-1" />
          <span>I agree to the <Link href="/terms" className="text-accent-hi underline">Terms</Link> and acknowledge the <Link href="/privacy" className="text-accent-hi underline">Privacy Policy</Link>. This is required for an account and is not marketing consent.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none transition focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Password (10+ characters)</span>
          <input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none transition focus:border-accent"
          />
        </label>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hi disabled:opacity-50"
        >
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already registered?{' '}
        <Link href="/login" className="text-accent-hi hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, type AuthFormState } from '../actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(loginAction, {});
  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-24">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 text-sm text-muted">Sign in to your Stampbench account.</p>
      <form action={formAction} className="flex flex-col gap-4">
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
          <span className="text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none transition focus:border-accent"
          />
        </label>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hi disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        No account?{' '}
        <Link href="/register" className="text-accent-hi hover:underline">
          Create one free
        </Link>
      </p>
    </div>
  );
}

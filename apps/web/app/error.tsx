'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-32 text-center">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mb-8 max-w-sm text-sm text-muted">
        An unexpected error occurred. It has been logged — try again, and contact support if it
        keeps happening.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hi"
      >
        Try again
      </button>
    </div>
  );
}

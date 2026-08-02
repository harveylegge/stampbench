import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-32 text-center">
      <div className="mb-4 font-mono text-sm text-faint">404</div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mb-8 max-w-sm text-sm text-muted">
        This page doesn&apos;t exist — a bit like a ZUGFeRD invoice without an embedded XML.
      </p>
      <Link href="/" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hi">
        Back home
      </Link>
    </div>
  );
}

/**
 * Shared building blocks for the legal pages.
 *
 * `Fill` marks a value that MUST be replaced with real company details before
 * these pages go live. It renders conspicuously (amber, monospace) so an
 * unfinished legal page is impossible to miss in review or in production.
 */

export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[0.85em] text-warning">
      {children}
    </span>
  );
}

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mb-8 text-sm text-faint">Last updated: {updated}</p>
      {intro && <div className="mb-8 leading-relaxed text-muted">{intro}</div>}
      <div className="prose-ig">{children}</div>
    </div>
  );
}

export function Clause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold tracking-tight text-text">
        <span className="mr-2 font-mono text-sm text-faint">{n}</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

import Link from 'next/link';
import { localePath, type Copy } from '@/lib/copy';

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

const VALIDATE_SNIPPET = `$ npx stampbench validate rechnung.xml

rechnung.xml  syntax: UBL | profile: xrechnung
  ERROR  BR-CO-17  VAT breakdown S @ 7%: tax amount
         should be 22.04 (314.86 × 7%) but is 99.99. (line 78)
  ERROR  BR-DE-15  Missing buyer reference (BT-10)… (~line 2)
INVALID — 2 errors, 0 warnings (56 rules run)`;

const FIX_SNIPPET = `$ npx stampbench fix rechnung.xml --write

rechnung.xml
  fix   line 78    BR-CO-17, BR-S-09  99.99 → 22.04
  keep            BR-DE-15  no derivable correct value —
                            this needs a human decision
1 fix applied, 1 error needing a person`;

/**
 * The marketing landing page, rendered from a copy dictionary so English and
 * German share one layout. Code samples stay untranslated on purpose: rule
 * ids, CLI flags and field names are the same in every language, and a
 * developer comparing the page to their terminal should see the same strings.
 */
export function Landing({ copy }: { copy: Copy }) {
  const path = (p: string) => localePath(copy.locale, p);

  return (
    <div lang={copy.locale}>
      {/* Hero */}
      <section className="hero-grid relative">
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-24 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {copy.hero.badge}
            </div>
            <h1 className="mb-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {copy.hero.titleTop}
              <br />
              <span className="text-accent">{copy.hero.titleAccent}</span>
            </h1>
            <p className="mb-8 max-w-md text-lg leading-relaxed text-text/90">{copy.hero.lede}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={path('playground')}
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-hi"
              >
                {copy.hero.ctaPrimary}
              </Link>
              <Link
                href="/docs"
                className="rounded-lg border border-border bg-surface px-5 py-2.5 font-medium transition hover:border-border-hi"
              >
                {copy.hero.ctaSecondary}
              </Link>
            </div>
            <div className="mt-8 font-mono text-sm text-faint">
              {copy.hero.install} <span className="text-accent">@stampbench/core</span>
            </div>
          </div>
          <div className="rounded-xl border border-border-hi bg-surface shadow-xl shadow-accent/5">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
              <span className="ml-3 font-mono text-xs text-muted">terminal</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-text">
              {VALIDATE_SNIPPET}
            </pre>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="border-t border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">
            {copy.problem.headingPre} <span className="font-mono text-danger">[BR-DE-15]</span>
            {copy.problem.headingPost}
          </h2>
          <p className="mb-12 max-w-2xl leading-relaxed text-muted">{copy.problem.body}</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {copy.features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
                <h3 className="mb-2 font-medium">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLI demo */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{copy.api.heading}</h2>
          <p className="mb-10 max-w-2xl text-muted">{copy.api.body}</p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3 font-mono text-xs text-muted">
                stampbench validate
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-muted">
                {VALIDATE_SNIPPET}
              </pre>
            </div>
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3 font-mono text-xs text-muted">
                stampbench fix
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-muted">
                {FIX_SNIPPET}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{copy.proof.heading}</h2>
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">{copy.proof.body}</p>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.proof.stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface p-5">
                <div className="text-2xl font-semibold tracking-tight text-accent">{s.figure}</div>
                <div className="mt-1 text-sm">{s.label}</div>
                <div className="mt-1 text-xs text-faint">{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/trust"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition hover:border-border-hi"
            >
              {copy.proof.evidence}
            </Link>
            <Link
              href="/security"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition hover:border-border-hi"
            >
              {copy.proof.security}
            </Link>
            <span className="text-sm text-faint">{copy.proof.note}</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-3 text-3xl font-semibold tracking-tight">{copy.cta.heading}</h2>
          <p className="mx-auto mb-8 max-w-md text-muted">{copy.cta.body}</p>
          <Link
            href={IS_STATIC ? 'https://www.npmjs.com/package/stampbench' : '/register'}
            className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-accent-hi"
          >
            {copy.cta.button}
          </Link>
        </div>
      </section>
    </div>
  );
}

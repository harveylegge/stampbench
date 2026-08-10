import Link from 'next/link';
import { localePath, type Copy } from '@/lib/copy';
import { HeroDemo } from '@/components/hero-demo';
import { MarketPicker } from '@/components/market-picker';
import { StatsBoard } from '@/components/stats-board';

const GITHUB_URL = 'https://github.com/harveylegge/stampbench';

/**
 * Terminal output, transcribed from real runs — the header line, the rule
 * ids, the wording of the "keep" reason and the trailing count are all what
 * the CLI actually prints. `--profile en16931` is shown rather than the
 * default because the profile flag is the whole point of the market model:
 * the same file is 40 rules in the European core and 56 in Germany.
 */
const VALIDATE_SNIPPET = `$ npx stampbench validate invoice.xml --profile en16931

invoice.xml  syntax: UBL | profile: en16931 | ruleset: 2026-08.2
  ERROR  BR-CO-17  VAT breakdown S @ 7%: tax amount should be
         22.04 (314.86 × 7%) but is 99.99. (line 78)
  ERROR  BR-11     Missing buyer country code (BT-55). (~line 39)
INVALID — 2 errors, 0 warnings (40 rules run)`;

const FIX_SNIPPET = `$ npx stampbench fix invoice.xml --profile en16931 --write

invoice.xml
  fix   line 78    BR-CO-17, BR-S-09  99.99 → 22.04
  keep            BR-11  no derivable correct value —
                         this needs a human decision, not arithmetic
1 fix applied, 1 error needing a person`;

/**
 * The marketing landing page, rendered from a copy dictionary so English and
 * German share one layout. Code samples stay untranslated on purpose: rule
 * ids, CLI flags and field names are the same in every language, and a
 * developer comparing the page to their terminal should see the same strings.
 *
 * Structure (2026-08 redesign): pain first, mandate as supporting context;
 * an interactive validate→fix panel as the hero visual; evidence charts with
 * every number linking to /trust; the free/paid split stated plainly; the
 * playground as the single conversion action.
 *
 * 2026-08 market pass: the English hero no longer names a jurisdiction. A
 * visitor's second question is "is this for my business?", so the market band
 * answers it before any standard is mentioned; the German page keeps its
 * XRechnung framing because a reader who arrived in German has already
 * answered that question. Everything below the band is unchanged in shape —
 * the evidence still sits high, because for a compliance product the evidence
 * *is* the pitch.
 */
export function Landing({ copy }: { copy: Copy }) {
  const path = (p: string) => localePath(copy.locale, p);

  return (
    <div lang={copy.locale}>
      {/* Hero */}
      <section className="hero-grid relative">
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-24 lg:grid-cols-2">
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
            {/* The two things the product does, as the two buttons.
                Previously the second slot went to a "choose your market"
                anchor, which meant the generator had no entry point here at
                all — and on mobile, where the nav is behind a hamburger, no
                entry point anywhere on the page. The market band is the very
                next section, so its link steps down to text without becoming
                hard to find. Full-width when stacked: two buttons wrapping
                mid-row on a phone reads as one broken button. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                href="/invoice-generator"
                className="rounded-lg bg-accent px-5 py-3 text-center font-medium text-white transition hover:bg-accent-hi sm:py-2.5"
              >
                {copy.hero.ctaCreate}
              </Link>
              <Link
                href={path('playground')}
                className="rounded-lg border border-border bg-surface px-5 py-3 text-center font-medium transition hover:border-border-hi sm:py-2.5"
              >
                {copy.hero.ctaPrimary}
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {/* An in-page anchor, not a route: the answer to "is this for my
                  business?" is one scroll away. */}
              <a href="#markets" className="font-medium text-accent-hi hover:underline">
                {copy.hero.ctaSecondary} ↓
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-faint">
              <span>
                {copy.hero.install} <span className="text-accent">@stampbench/core</span>
              </span>
              <a href={GITHUB_URL} className="transition hover:text-muted">
                {copy.nav.github} ↗
              </a>
            </div>
          </div>
          <HeroDemo copy={copy} />
        </div>

        {/* Trust bar — formats and licence, not certifications */}
        <div className="border-t border-border bg-surface/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-4 text-xs font-medium tracking-wide text-faint">
            {copy.trustbar.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* The market question, asked before any standard is named */}
      <MarketPicker copy={copy.markets} />

      {/* Proof — high on the page: for a compliance product, evidence IS the pitch */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{copy.proof.heading}</h2>
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">{copy.proof.body}</p>
          <StatsBoard copy={copy} />
          <div className="mt-8 flex flex-wrap items-center gap-4">
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

      {/* The problem: official error vs ours */}
      <section className="border-t border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">
            {copy.problem.headingPre}{' '}
            <span className="font-mono text-danger">[{copy.problem.rule}]</span>
            {copy.problem.headingPost}
          </h2>
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">{copy.problem.body}</p>

          <div className="mb-14 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3 text-xs font-medium text-faint">
                {copy.compare.officialTitle}
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-muted">
                {copy.compare.officialBody}
              </pre>
            </div>
            <div className="rounded-xl border border-accent/40 bg-surface">
              <div className="border-b border-border px-5 py-3 text-xs font-medium text-accent-hi">
                {copy.compare.oursTitle}
              </div>
              <div className="space-y-3 p-5 text-sm leading-relaxed">
                <p className="text-text">{copy.compare.oursExplain}</p>
                <p className="text-xs text-muted">{copy.compare.oursFix}</p>
              </div>
            </div>
          </div>

          {/* The product principle, elevated from a footnote to a statement */}
          <figure className="mb-14 rounded-xl border border-accent/30 bg-accent-dim/30 px-6 py-8 text-center">
            <blockquote className="mx-auto max-w-2xl">
              <p className="mb-2 text-xl font-semibold tracking-tight text-accent-hi">
                {copy.principle.title}
              </p>
              <p className="text-sm leading-relaxed text-muted">{copy.principle.body}</p>
            </blockquote>
          </figure>

          {/* Three pillars; the six original detail cards live inside native
              <details>, so the depth is still there for whoever wants it. */}
          <div className="grid gap-6 lg:grid-cols-3">
            {copy.pillars.map((p) => (
              <div key={p.num} className="rounded-xl border border-border bg-surface p-6">
                <div className="mb-3 font-mono text-sm text-accent">{p.num}</div>
                <h3 className="mb-2 text-xl font-semibold tracking-tight">{p.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted">{p.tagline}</p>
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-medium text-accent-hi transition hover:underline">
                    <span className="group-open:hidden">{p.details} +</span>
                    <span className="hidden group-open:inline">{p.details} −</span>
                  </summary>
                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    {p.items.map((item) => (
                      <div key={item.title}>
                        <h4 className="mb-1 text-sm font-medium">{item.title}</h4>
                        <p className="text-sm leading-relaxed text-muted">{item.body}</p>
                      </div>
                    ))}
                  </div>
                </details>
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
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-faint">{copy.api.note}</p>
        </div>
      </section>

      {/* Local-first */}
      <section className="border-t border-border bg-surface/40 py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{copy.local.heading}</h2>
          <p className="mx-auto mb-8 max-w-2xl leading-relaxed text-muted">{copy.local.body}</p>
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 sm:flex-row">
            {copy.local.steps.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    i === 1
                      ? 'border-accent/40 bg-accent-dim/40 font-mono text-accent-hi'
                      : 'border-border bg-surface text-muted'
                  }`}
                >
                  {step}
                </span>
                {i < 2 && <span className="hidden text-faint sm:block">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free / paid */}
      <section className="border-t border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-10 text-2xl font-semibold tracking-tight">{copy.model.heading}</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-1 font-medium text-success">{copy.model.freeTitle}</div>
              <p className="mb-4 text-sm text-muted">{copy.model.freeBody}</p>
              <ul className="space-y-2 text-sm text-muted">
                {copy.model.freeItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-success" aria-hidden>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-accent/40 bg-surface p-6">
              <div className="mb-1 font-medium text-accent-hi">{copy.model.paidTitle}</div>
              <p className="mb-4 text-sm text-muted">{copy.model.paidBody}</p>
              <ul className="mb-4 space-y-2 text-sm text-muted">
                {copy.model.paidItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-accent" aria-hidden>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="text-sm font-medium text-accent-hi hover:underline">
                {copy.model.pricing}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-3 text-3xl font-semibold tracking-tight">{copy.cta.heading}</h2>
          <p className="mx-auto mb-8 max-w-md text-muted">{copy.cta.body}</p>
          {/* Both doors again at the foot of the page — a visitor who read the
              whole thing should not have to scroll back up to act. */}
          <div className="mx-auto flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/invoice-generator"
              className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-accent-hi"
            >
              {copy.hero.ctaCreate}
            </Link>
            <Link
              href={path('playground')}
              className="rounded-lg border border-border bg-surface px-6 py-3 font-medium transition hover:border-border-hi"
            >
              {copy.cta.button}
            </Link>
          </div>
          <div className="mt-5 font-mono text-sm text-faint">
            {copy.cta.install} <span className="text-accent">@stampbench/core</span>
          </div>
        </div>
      </section>
    </div>
  );
}

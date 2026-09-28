import type { Metadata } from 'next';
import Link from 'next/link';

import { en } from '@/lib/copy';
import { RULE_COUNTS } from '@/lib/markets';

export const metadata: Metadata = {
  title: 'Developer platform — e-invoicing infrastructure',
  description:
    'Build compliant e-invoicing into your software. Validate and generate XRechnung / EN 16931 documents with a TypeScript-first engine, a CLI and a hosted REST API. UBL and CII, deterministic rules, source locations on every violation.',
  alternates: { canonical: '/developers' },
  openGraph: {
    title: 'Stampbench for developers',
    description:
      'A TypeScript-first e-invoicing engine: deterministic EN 16931 / XRechnung validation, generation, repair, a CLI and a hosted API.',
  },
};

/**
 * The developer front door.
 *
 * Everything on this page used to be *on the homepage*, competing for space
 * with an invoice generator aimed at people who have never heard of UBL. That
 * split the difference badly in both directions: the terminal transcripts read
 * as noise to a freelancer, and a developer had to scroll past a form to find
 * out whether there was an engine underneath.
 *
 * So the technical product is not reduced here — it is concentrated. This page
 * uses the vocabulary a developer came for (rule ids, syntaxes, profiles,
 * rulesets, exit codes) without apology, because that vocabulary is the
 * evidence that Stampbench is infrastructure rather than a form.
 *
 * English only, like /docs and /pricing. The German copy for the shared blocks
 * is still maintained in lib/copy.ts against a future /de/developers.
 */

const GITHUB_URL = 'https://github.com/harveylegge/stampbench';

/** Transcribed from real runs — the header line, rule ids, wording and counts. */
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
                         this needs a human decision, not arithmetic`;

const INSTALL_SNIPPET = `npm install @stampbench/core

import { validateXml, generateUblInvoice, withComputedTotals } from '@stampbench/core';

const result = validateXml(xml, { profile: 'xrechnung' });
if (!result.valid) {
  for (const v of result.violations) {
    console.error(v.ruleId, v.message, v.line);
  }
}`;

const REASONS = [
  {
    title: 'TypeScript-first',
    body: 'A pure-TypeScript engine with no Java runtime and no native dependencies. It installs like any other npm package and runs in Node, in a worker, or in the browser.',
  },
  {
    title: 'Deterministic validation',
    body: 'Rules are code, not a model’s opinion. The same document and the same ruleset version always produce the same verdict, which is what makes a result worth pinning in CI.',
  },
  {
    title: 'Diagnostics you can act on',
    body: 'Every violation carries the rule id, the business term (BT-/BG-) and a source location, so a failing invoice can annotate the exact line of a pull request.',
  },
  {
    title: 'Generate as well as validate',
    body: `Build UBL from a typed invoice model with totals and the VAT breakdown computed from your lines, so the BR-CO arithmetic rules pass by construction.`,
  },
  {
    title: 'Local-first',
    body: 'The library and CLI run entirely in your process. No upload, no account, no network — which is also the only honest way to promise that invoices stay on your infrastructure.',
  },
  {
    title: 'Hosted API when you want it',
    body: 'The same engine behind a REST endpoint, for languages that are not JavaScript and for teams who would rather not own the rule-update treadmill.',
  },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="developer-code overflow-x-auto border border-border bg-surface p-5 font-mono text-xs leading-relaxed text-muted">
      {children}
    </pre>
  );
}

export default function DevelopersPage() {
  return (
    <main className="developers-editorial">
      {/* Hero */}
      <section className="developer-hero border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="developer-kicker mb-4 inline-flex items-center gap-2 font-mono text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            @stampbench/core · MIT
          </div>
          <h1 className="mb-5 max-w-4xl text-[2.1rem] font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Build compliant e-invoicing<br/><em>without the rulebook.</em>
          </h1>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-muted">
            Validate and generate XRechnung / EN 16931 documents with a TypeScript-first engine, a
            CLI and a hosted API. Both syntaxes — UBL and CII — auto-detected, with the rule id and
            the source location on every violation.
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="/playground"
              className="sb-press rounded-lg bg-accent px-6 py-3 text-center font-medium text-white transition hover:bg-accent-hi"
            >
              Try the playground
            </Link>
            <Link
              href="/docs"
              className="sb-press rounded-lg border border-border bg-surface px-6 py-3 text-center font-medium transition hover:border-border-hi"
            >
              Read the docs
            </Link>
            <a
              href={GITHUB_URL}
              className="rounded-lg px-2 py-3 text-center text-sm text-muted transition hover:text-text"
            >
              GitHub →
            </a>
          </div>
          <p className="mt-4 font-mono text-sm text-faint">
            npm install <span className="text-accent">@stampbench/core</span>
          </p>
          <div className="developer-spec-strip" aria-label="Developer platform highlights">
            <span><small>01</small> TYPESCRIPT FIRST</span>
            <span><small>02</small> LOCAL BY DEFAULT</span>
            <span><small>03</small> UBL + CII</span>
            <span><small>04</small> MIT LICENSED</span>
          </div>
        </div>
      </section>

      {/* Why developers use it */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">
            Why developers use Stampbench
          </h2>
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">
            The compliance layer is the part of an invoicing integration that never stops moving.
            Stampbench is the layer, published as source you can read.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map((reason) => (
              <div key={reason.title} className="rounded-xl border border-border bg-surface p-5">
                <h3 className="mb-2 font-medium tracking-tight">{reason.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{reason.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quickstart */}
      <section className="border-t border-border bg-surface/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">Quickstart</h2>
          <p className="mb-8 max-w-2xl leading-relaxed text-muted">
            Install the library and validate a document. No key, no account, no network call.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 font-mono text-xs text-faint">library</div>
              <Code>{INSTALL_SNIPPET}</Code>
            </div>
            <div>
              <div className="mb-2 font-mono text-xs text-faint">hosted API</div>
              <Code>{`curl -s https://stampbench.com/api/v1/validate \\
  -H "Authorization: Bearer $STAMPBENCH_API_KEY" \\
  -H "Content-Type: application/xml" \\
  --data-binary @invoice.xml`}</Code>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Anonymous calls are allowed at 10/hour per IP so you can try it before signing up.
                Keys live on your{' '}
                <Link href="/account" className="text-accent-hi hover:underline">
                  account page
                </Link>
                ; the full reference is in the{' '}
                <Link href="/docs" className="text-accent-hi hover:underline">
                  documentation
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CLI */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{en.api.heading}</h2>
          <p className="mb-10 max-w-2xl text-muted">{en.api.body}</p>
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
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-faint">{en.api.note}</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            <code className="font-mono text-xs">stampbench regress</code> compares a directory
            against a future ruleset and exits <code className="font-mono text-xs">1</code> when
            anything would start failing —{' '}
            <Link href="/docs#regression" className="text-accent-hi hover:underline">
              regression testing in the docs
            </Link>
            .
          </p>
        </div>
      </section>

      {/* The diagnostics argument, made concretely */}
      <section className="border-t border-border bg-surface/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">
            {en.problem.headingPre} <span className="font-mono text-danger">[{en.problem.rule}]</span>
            {en.problem.headingPost}
          </h2>
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">{en.problem.body}</p>

          <div className="mb-14 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3 text-xs font-medium text-faint">
                {en.compare.officialTitle}
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-muted">
                {en.compare.officialBody}
              </pre>
            </div>
            <div className="rounded-xl border border-accent/40 bg-surface">
              <div className="border-b border-border px-5 py-3 text-xs font-medium text-accent-hi">
                {en.compare.oursTitle}
              </div>
              <div className="space-y-3 p-5 text-sm leading-relaxed">
                <p className="text-text">{en.compare.oursExplain}</p>
                <p className="text-xs text-muted">{en.compare.oursFix}</p>
              </div>
            </div>
          </div>

          <figure className="mb-14 rounded-xl border border-accent/30 bg-accent-dim/30 px-6 py-8 text-center">
            <blockquote className="mx-auto max-w-2xl">
              <p className="mb-2 text-xl font-semibold tracking-tight text-accent-hi">
                {en.principle.title}
              </p>
              <p className="text-sm leading-relaxed text-muted">{en.principle.body}</p>
            </blockquote>
          </figure>

          <div className="grid gap-6 lg:grid-cols-3">
            {en.pillars.map((p) => (
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

      {/* Coverage, stated as fact rather than implied */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">What actually runs</h2>
          <p className="mb-8 max-w-2xl leading-relaxed text-muted">
            Two profiles, both syntaxes, one national customisation. Where a market has nothing
            implemented, the coverage matrix says so instead of implying more.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { figure: String(RULE_COUNTS.en16931), label: 'EN 16931 core rules', sub: 'The European profile' },
              { figure: String(RULE_COUNTS.xrechnung), label: 'XRechnung 3.0 rules', sub: 'The core plus the BR-DE profile' },
              { figure: 'UBL + CII', label: 'Syntaxes validated', sub: 'Auto-detected; UBL for generation' },
              { figure: 'Open', label: 'Public parity suite', sub: 'Reference differences documented' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-surface p-5">
                <div className="text-2xl font-semibold tracking-tight">{stat.figure}</div>
                <div className="mt-1 text-sm text-text">{stat.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-faint">{stat.sub}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link href="/docs#rules" className="text-accent-hi hover:underline">
              Rules coverage →
            </Link>
            <Link href="/markets" className="text-accent-hi hover:underline">
              Market coverage matrix →
            </Link>
            <Link href="/trust" className="text-accent-hi hover:underline">
              Test evidence and known limitations →
            </Link>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-faint">
            Stampbench is developer tooling, not legal advice. For certification-grade sign-off, run
            the official KoSIT validator as well — the goal here is that by the time you do, it
            passes, and the parity results are published rather than asserted.
          </p>
        </div>
      </section>

      {/* Free / paid — the developer version of the pricing question */}
      <section className="border-t border-border bg-surface/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-10 text-2xl font-semibold tracking-tight">{en.model.heading}</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-1 font-medium text-success">{en.model.freeTitle}</div>
              <p className="mb-4 text-sm text-muted">{en.model.freeBody}</p>
              <ul className="space-y-2 text-sm text-muted">
                {en.model.freeItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-success" aria-hidden>
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-accent/40 bg-surface p-6">
              <div className="mb-1 font-medium text-accent-hi">{en.model.paidTitle}</div>
              <p className="mb-4 text-sm text-muted">{en.model.paidBody}</p>
              <ul className="mb-4 space-y-2 text-sm text-muted">
                {en.model.paidItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-accent" aria-hidden>
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing?for=developers"
                className="text-sm font-medium text-accent-hi hover:underline"
              >
                Developer pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Local-first close */}
      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{en.local.heading}</h2>
          <p className="mx-auto mb-8 max-w-2xl leading-relaxed text-muted">{en.local.body}</p>
          <div className="mx-auto mb-10 flex max-w-3xl flex-col items-center justify-center gap-3 sm:flex-row">
            {en.local.steps.map((step, i) => (
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
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/playground"
              className="sb-press rounded-lg bg-accent px-6 py-3 text-center font-medium text-white transition hover:bg-accent-hi"
            >
              Open the playground
            </Link>
            <Link
              href="/docs"
              className="sb-press rounded-lg border border-border bg-surface px-6 py-3 text-center font-medium transition hover:border-border-hi"
            >
              Read the docs
            </Link>
          </div>
          <p className="mt-6 text-sm text-faint">
            Not building an integration?{' '}
            <Link href="/invoice-generator" className="text-accent-hi hover:underline">
              Just create an invoice instead
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

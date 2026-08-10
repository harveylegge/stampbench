import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Trust & test evidence',
  description:
    'How Stampbench proves correctness: 256 automated tests, 86 official XRechnung test-suite instances, an adversarial security review, and a published KoSIT parity harness — including what we have not yet proven.',
};

/**
 * Every figure on this page is generated from artefacts in the repository
 * (test runs, tools/parity/report/parity-report.json, git history) — see
 * docs/architecture.md. Nothing here is marketing estimation. When a number
 * changes, this page changes with it.
 */

const TEST_SUITES = [
  { name: '@stampbench/core', count: 136, covers: 'Rule engine, UBL + CII parsing, generation, totals arithmetic, repair, rulesets, round-trips' },
  { name: 'stampbench (CLI)', count: 50, covers: 'Validate/fix/generate/regress commands, CI exit codes, JSON/SARIF output, error paths' },
  { name: 'Web application', count: 70, covers: 'Plan/quota logic, API-key hashing, rate limiting, billing webhooks, market coverage claims, and the invoice builder’s money, tax and generation logic' },
];

const FLAGGED = [
  { file: 'instances/extension/05.01a-INVOICE_ubl.xml', syntax: 'UBL', rule: 'BR-CO-16' },
  { file: 'instances/technical-cases/cius/01.05_minimal_test_ubl.xml', syntax: 'UBL', rule: 'BR-DE-16' },
  { file: 'instances/technical-cases/cius/01.05_minimal_test_uncefact.xml', syntax: 'CII', rule: 'BR-DE-16' },
];

function Stat({ figure, label, sub }: { figure: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-2xl font-semibold tracking-tight">{figure}</div>
      <div className="mt-1 text-sm text-text">{label}</div>
      {sub && <div className="mt-1 text-xs leading-relaxed text-faint">{sub}</div>}
    </div>
  );
}

export default function TrustPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">Trust &amp; test evidence</h1>
      <p className="mb-10 max-w-2xl leading-relaxed text-muted">
        A compliance tool is only worth using if it is right. This page shows exactly how we test
        Stampbench, what the results are, and — just as importantly — what we have{' '}
        <strong className="text-text">not</strong> yet proven. Every figure below comes from an
        artefact in our repository, not from an estimate.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat figure="256" label="Automated tests passing" sub="Across the library, CLI and web app" />
        <Stat figure="86" label="Official test-suite documents" sub="45 UBL + 41 CII, run through the engine" />
        <Stat figure="56" label="Validation rules active" sub="XRechnung profile; 40 in the EN 16931 core profile" />
      </div>

      <p className="mb-12 max-w-2xl text-sm leading-relaxed text-muted">
        The same standard applies to what we claim about <em>markets</em>. One national
        customisation of EN 16931 is implemented — Germany&apos;s — and the coverage matrix says so
        for every other market rather than implying more.{' '}
        <Link href="/markets" className="text-accent-hi hover:underline">
          See what is and is not covered
        </Link>
        .
      </p>

      {/* ---------- Automated tests ---------- */}
      <section className="mb-12">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">1. Automated test suite</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Every commit runs the full suite. The tests are not smoke tests — they assert specific
          rule outcomes (for example, that a one-cent discrepancy in the totals chain is{' '}
          <em>rejected</em>, and that a legitimate one-cent VAT rounding difference is{' '}
          <em>accepted</em>).
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-faint">
              <tr>
                <th className="px-4 py-2.5 font-normal">Package</th>
                <th className="px-4 py-2.5 font-normal">Tests</th>
                <th className="px-4 py-2.5 font-normal">What they cover</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              {TEST_SUITES.map((s) => (
                <tr key={s.name} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs text-text">{s.name}</td>
                  <td className="px-4 py-2.5 text-success">{s.count} passing</td>
                  <td className="px-4 py-2.5">{s.covers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          One structural guarantee is enforced by test: <strong className="text-text">generate →
          parse → validate round-trips cleanly</strong>. A document we produce, re-read from XML,
          must validate against the same rules — so the generator and the validator cannot silently
          drift apart.
        </p>
      </section>

      {/* ---------- Official corpus ---------- */}
      <section className="mb-12">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">
          2. The official XRechnung test suite
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          We run the public test corpus published by KoSIT (the German coordination office for IT
          standards) — <code className="font-mono text-xs text-accent-hi">itplr-kosit/xrechnung-testsuite@v2026-01-31</code>,
          XRechnung 3.0.2 — through our engine on every parity run.
        </p>
        <div className="mb-4 grid gap-4 sm:grid-cols-4">
          <Stat figure="86" label="Instances processed" />
          <Stat figure="83" label="Accepted" />
          <Stat figure="3" label="Flagged" sub="Listed in full below" />
          <Stat figure="0" label="Crashes or parse failures" />
        </div>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Both syntaxes are covered: <strong className="text-text">45 UBL</strong> and{' '}
          <strong className="text-text">41 CII</strong> (ZUGFeRD / Factur-X style) documents. Zero
          exceptions means no document in the official corpus crashed the parser — a baseline we
          hold to.
        </p>
        <h3 className="mb-2 mt-6 text-sm font-medium">The three we flag — published openly</h3>
        <p className="mb-3 text-sm leading-relaxed text-muted">
          These are the reference documents our engine currently rejects. We publish them rather
          than hide them: they are open questions about whether our implementation of these two
          rules is stricter than the reference, and they are the first thing our parity run will
          settle.
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-faint">
              <tr>
                <th className="px-4 py-2.5 font-normal">Document</th>
                <th className="px-4 py-2.5 font-normal">Syntax</th>
                <th className="px-4 py-2.5 font-normal">Rule we raise</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              {FLAGGED.map((f) => (
                <tr key={f.file} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs">{f.file}</td>
                  <td className="px-4 py-2.5">{f.syntax}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-warning">{f.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Parity ---------- */}
      <section className="mb-12">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">
          3. KoSIT parity harness — what it is, and what it has not yet proven
        </h2>
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm leading-relaxed text-warning">
            <strong>Status: harness built, dual-run pending.</strong> We have not yet published a
            parity figure, because we have not yet run one. Any vendor claiming
            &ldquo;100&nbsp;% parity&rdquo; without a reproducible report should be asked for the report.
          </p>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          The official KoSIT validator is the legal reference for XRechnung. Our harness pins exact
          versions of it (validator{' '}
          <code className="font-mono text-xs text-accent-hi">1.6.2</code>, XRechnung configuration{' '}
          <code className="font-mono text-xs text-accent-hi">3.0.2</code>) with byte-exact download
          verification, runs both validators over the same corpus, and emits a per-document delta
          report classified into two categories:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-danger">False green</strong> — KoSIT rejects, we accept. This is
            the dangerous direction: it means we would have told you an invoice was fine when it
            was not. Our target for this number is zero, permanently.
          </li>
          <li>
            <strong className="text-warning">False alarm</strong> — KoSIT accepts, we reject. Noisy
            but safe; it costs you time, not a rejected invoice.
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          An honest limitation we will state on the report itself: the official corpus consists
          mostly of documents that <em>should</em> validate, so it tests the false-alarm direction
          well and the false-green direction only weakly. A mutation corpus is the next step.
        </p>
      </section>

      {/* ---------- Security review ---------- */}
      <section className="mb-12">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">4. Adversarial code review</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Before launch the codebase was put through a multi-agent adversarial review across four
          dimensions — security, rule correctness, API/billing logic, and framework misuse — in
          which every claimed finding had to survive a second reviewer whose job was to{' '}
          <em>refute</em> it. Twenty-five findings survived that check and were triaged; all
          high-severity items were fixed before this page was written.
        </p>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          The most consequential fix is worth naming, because it is exactly the class of bug that
          makes compliance tools untrustworthy: our totals comparison originally used a
          ±0.011 tolerance on the EN 16931 summation rules, which meant a genuine{' '}
          <strong className="text-text">one-cent-wrong invoice could pass</strong>. Those rules are
          exact equalities; the tolerance is now 0.005 (float-noise only), and the ±0.01 rounding
          allowance is applied solely to BR-CO-17, the one rule that involves multiplication. There
          is a regression test for both directions.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Other fixes in the same pass: invalid or revoked API keys now return{' '}
          <code className="font-mono text-xs">401</code> instead of silently falling back to the
          anonymous tier, duplicate subscriptions are blocked at checkout, and all API inputs are
          bounded and rejected if non-finite.
        </p>
      </section>

      {/* ---------- What we don't claim ---------- */}
      <section className="mb-12">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">5. What we do not claim</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          We would rather lose a deal than win one on an overstatement.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-text">This is not legal advice</strong>, and passing Stampbench
            is not a legal guarantee that an authority or access point will accept your invoice.
            For certification-grade sign-off, run the official KoSIT validator too. Our job is to
            make that run pass.
          </li>
          <li>
            <strong className="text-text">Rule coverage is a documented subset</strong>, not the
            complete rule set — {' '}
            <Link href="/docs#rules" className="text-accent-hi hover:underline">
              exactly which rules are implemented is listed in the docs
            </Link>
            . It grows with every release, and the ruleset version is stamped into every response.
          </li>
          <li>
            <strong className="text-text">No parity percentage yet</strong>, as stated above.
          </li>
          <li>
            <strong className="text-text">No SOC 2 or ISO 27001 certification.</strong> We are early;
            we will say so plainly rather than imply otherwise.
          </li>
          <li>
            <strong className="text-text">Generation is UBL today.</strong> Validation reads both UBL
            and CII; Factur-X PDF generation is on the roadmap, not shipped.
          </li>
        </ul>
      </section>

      {/* ---------- Verify yourself ---------- */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Verify any of this yourself</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          The rule engine is MIT-licensed and the parity harness is in the same repository. You do
          not have to take our word for any figure on this page — run it.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs leading-relaxed text-muted">
{`npm test                       # the full suite
node tools/parity/download.mjs # fetch the pinned official validator + corpus
node tools/parity/run.mjs      # dual-run and emit the delta report`}
        </pre>
        <p className="mt-4 text-sm text-muted">
          Version pinning is built into the product too: every validation response carries{' '}
          <code className="font-mono text-xs text-accent-hi">meta.rulesetVersion</code> and{' '}
          <code className="font-mono text-xs text-accent-hi">meta.specVersions</code>, so you can
          always answer &ldquo;which spec release was this checked against?&rdquo; in an audit.
        </p>
      </section>

      <p className="mt-10 text-center text-sm text-faint">
        Questions about any figure here?{' '}
        <Link href="/security" className="text-accent-hi hover:underline">
          See our security practices
        </Link>{' '}
        or get in touch — we will show you the artefact.
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'InvoiceGate API reference: validate and generate XRechnung / EN 16931 e-invoices via REST or the @invoicegate/core TypeScript library.',
};

function Code({ children }: { children: string }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-muted">
      {children}
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 mt-12 scroll-mt-20 text-xl font-semibold tracking-tight">
      <a href={`#${id}`} className="hover:text-accent-hi">
        {children}
      </a>
    </h2>
  );
}

export default function DocsPage() {
  const sections = [
    ['quickstart', 'Quickstart'],
    ['auth', 'Authentication'],
    ['validate', 'POST /api/v1/validate'],
    ['generate', 'POST /api/v1/generate'],
    ['explain', 'POST /api/ai/explain'],
    ['limits', 'Rate limits & quotas'],
    ['errors', 'Error format'],
    ['library', 'The open-source library'],
    ['rules', 'Rules coverage'],
  ] as const;

  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 py-10">
      <aside className="hidden w-52 shrink-0 lg:block">
        <nav className="sticky top-24 flex flex-col gap-1 text-sm">
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-surface hover:text-text">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 max-w-3xl flex-1">
        <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-2 text-muted">
          Everything you need to validate and generate compliant e-invoices. Base URL:{' '}
          <code className="font-mono text-sm text-accent-hi">https://invoicegate.dev</code>
        </p>

        <H2 id="quickstart">Quickstart</H2>
        <p className="text-sm leading-relaxed text-muted">
          Validate a document straight away — anonymous calls are allowed (10/hour per IP):
        </p>
        <Code>{`curl -s https://invoicegate.dev/api/v1/validate \\
  -H "Content-Type: application/xml" \\
  --data-binary @invoice.xml`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          For real usage, <Link href="/register" className="text-accent-hi hover:underline">create a free account</Link>,
          generate an API key in the dashboard, and send it as a Bearer token.
        </p>

        <H2 id="auth">Authentication</H2>
        <p className="text-sm leading-relaxed text-muted">
          Send your key in the <code className="font-mono text-accent-hi">Authorization</code> header
          (or <code className="font-mono text-accent-hi">x-api-key</code>):
        </p>
        <Code>{`Authorization: Bearer ig_live_4f3a…`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          Keys are shown once at creation and stored hashed. Revoke leaked keys instantly in the
          dashboard.
        </p>

        <H2 id="validate">POST /api/v1/validate</H2>
        <p className="text-sm leading-relaxed text-muted">
          Validates an e-invoice against EN 16931 plus (by default) the German XRechnung profile.
          Both syntaxes are auto-detected: <strong className="text-text">UBL</strong> and{' '}
          <strong className="text-text">CII</strong> (ZUGFeRD / Factur-X XML — what German
          companies mostly receive). Accepts raw XML
          (<code className="font-mono">Content-Type: application/xml</code>) or JSON:
        </p>
        <Code>{`// Request (JSON form)
{ "xml": "<?xml version=\\"1.0\\"?><Invoice …>", "profile": "xrechnung" }

// Response
{
  "valid": false,
  "profile": "xrechnung",
  "syntax": "ubl",            // or "cii" (ZUGFeRD/Factur-X)
  "errorCount": 1,
  "warningCount": 1,
  "violations": [
    {
      "ruleId": "BR-DE-15",
      "severity": "error",
      "message": "Missing buyer reference (BT-10). For German public-sector buyers this is the Leitweg-ID…",
      "terms": ["BT-10"]
    }
  ],
  "meta": { "rulesRun": 42, "rulesetVersion": "2026-08.1" }
}`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          Query/body parameter <code className="font-mono">profile</code>:{' '}
          <code className="font-mono">xrechnung</code> (default) or <code className="font-mono">en16931</code>{' '}
          (core rules only, for non-German EU invoices).
        </p>

        <H2 id="generate">POST /api/v1/generate</H2>
        <p className="text-sm leading-relaxed text-muted">
          Generates XRechnung 3.0 UBL XML from a JSON invoice. Unless disabled, totals (BT-106…BT-115)
          and the VAT breakdown (BG-23) are computed from your lines so the BR-CO arithmetic rules
          pass by construction.
        </p>
        <Code>{`// Request
{
  "invoice": {
    "number": "RE-2026-0043",
    "issueDate": "2026-08-02",
    "currencyCode": "EUR",
    "buyerReference": "PO-2026-118",
    "seller": { "name": "…", "vatId": "DE123456789", "address": { … }, "contact": { … } },
    "buyer":  { "name": "…", "address": { … } },
    "payment": { "meansTypeCode": "58", "creditTransfers": [{ "iban": "DE89…" }] },
    "lines": [{
      "quantity": 12, "unitCode": "HUR",
      "item": { "name": "Beratung" },
      "price": { "netPrice": 120 },
      "vat": { "categoryCode": "S", "rate": 19 }
    }]
  },
  "options": { "computeTotals": true, "validate": true, "profile": "xrechnung" }
}

// Response
{ "xml": "<?xml version=\\"1.0\\" …", "validation": { "valid": true, … } }`}</Code>

        <H2 id="explain">POST /api/ai/explain</H2>
        <p className="text-sm leading-relaxed text-muted">
          Turns the violations array from a validate call into a plain-language fix plan, written by
          Claude. Pass the violations exactly as you received them:
        </p>
        <Code>{`{ "violations": [ …from /api/v1/validate… ] }

// Response
{ "explanation": "Found 2 blocking errors…\\n1. **BR-DE-15** …", "source": "claude" }`}</Code>

        <H2 id="limits">Rate limits &amp; quotas</H2>
        <div className="my-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-faint">
              <tr>
                <th className="px-4 py-2 font-normal">Plan</th>
                <th className="px-4 py-2 font-normal">Calls / month</th>
                <th className="px-4 py-2 font-normal">Rate limit</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-t border-border"><td className="px-4 py-2">Anonymous</td><td className="px-4 py-2">10 / hour / IP</td><td className="px-4 py-2">—</td></tr>
              <tr className="border-t border-border"><td className="px-4 py-2">Free</td><td className="px-4 py-2">100</td><td className="px-4 py-2">10 / min</td></tr>
              <tr className="border-t border-border"><td className="px-4 py-2">Developer</td><td className="px-4 py-2">5,000</td><td className="px-4 py-2">60 / min</td></tr>
              <tr className="border-t border-border"><td className="px-4 py-2">Agency</td><td className="px-4 py-2">25,000</td><td className="px-4 py-2">120 / min</td></tr>
              <tr className="border-t border-border"><td className="px-4 py-2">Platform</td><td className="px-4 py-2">100,000+</td><td className="px-4 py-2">300 / min</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Responses include <code className="font-mono">X-Quota-Used</code>,{' '}
          <code className="font-mono">X-Quota-Limit</code> and{' '}
          <code className="font-mono">X-RateLimit-Remaining</code> headers.
        </p>

        <H2 id="errors">Error format</H2>
        <Code>{`{ "error": { "code": "quota_exceeded", "message": "Monthly quota reached (100/100 …)" } }

// Codes: invalid_request, invalid_json, payload_too_large,
//        rate_limited (429), quota_exceeded (402), unauthenticated (401)`}</Code>

        <H2 id="library">The open-source library</H2>
        <p className="text-sm leading-relaxed text-muted">
          <code className="font-mono text-accent-hi">@invoicegate/core</code> (MIT) runs the same
          validation and generation locally — unlimited, offline, free forever:
        </p>
        <Code>{`npm install @invoicegate/core

import {
  validateUblXml,       // XML → violations
  validateInvoice,      // semantic model → violations
  generateXRechnungUbl, // semantic model → XRechnung UBL
  withComputedTotals,   // fills BG-22 totals + BG-23 VAT breakdown
} from '@invoicegate/core';

const result = validateUblXml(xml, { profile: 'xrechnung' });
if (!result.valid) console.table(result.violations);`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          The hosted API adds always-current rules, AI explanations, cross-language access, usage
          history, and zero maintenance.
        </p>

        <H2 id="rules">Rules coverage</H2>
        <p className="text-sm leading-relaxed text-muted">
          InvoiceGate implements a documented, growing subset of the official rule sets — currently:
        </p>
        <ul className="my-3 list-disc pl-5 text-sm leading-relaxed text-muted">
          <li>EN 16931 structural rules: BR-01…BR-16, per-line BR-21…BR-27, BR-CO-04</li>
          <li>Totals &amp; VAT arithmetic: BR-CO-10, -13, -14, -15, -16, -17, -18, -25</li>
          <li>
            VAT category families — BR-S, BR-Z, BR-E, BR-AE, BR-K, BR-G, BR-O: breakdown
            presence, rate constraints, per-category taxable/VAT arithmetic, exemption reasons
          </li>
          <li>XRechnung (German CIUS): BR-DE-1…9, BR-DE-15, BR-DE-16, BR-DE-17, BR-DE-21, plus credit-transfer/IBAN checks</li>
          <li>Format &amp; code-list diagnostics (IG-* rule ids): ISO dates, currency/country codes, UNCL 5305 VAT categories</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          Syntax coverage: <strong className="text-text">UBL and CII</strong> (ZUGFeRD/Factur-X
          XML) for validation, UBL for generation. Every result is version-pinned to the spec
          release it was checked against (EN 16931-1:2017, XRechnung 3.0 — see{' '}
          <code className="font-mono">meta.specVersions</code>). InvoiceGate is developer tooling,
          not legal advice — for certification-grade sign-off, also run the official KoSIT
          validator in CI. Our goal is that by the time you run it, it passes — and we publish our
          divergence from the KoSIT validator rather than asking you to take that on faith.
        </p>
      </article>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

import { LangTabs } from './lang-tabs';

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';


export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Stampbench API reference: validate and generate XRechnung / EN 16931 e-invoices via REST or the @stampbench/core TypeScript library.',
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
    ['regression', 'Regression testing'],
    ['auth', 'Authentication'],
    ['validate', 'POST /api/v1/validate'],
    ['generate', 'POST /api/v1/generate'],
    ['explain', 'POST /api/ai/explain'],
    ['payment-webhook', 'Payment webhook'],
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
          <code className="font-mono text-sm text-accent-hi">https://stampbench.com</code>
        </p>
        <p className="mt-3 text-sm text-muted">
          New here? Start on the{' '}
          <Link href="/developers" className="text-accent-hi hover:underline">
            developer platform overview
          </Link>{' '}
          or try it without installing anything in the{' '}
          <Link href="/playground" className="text-accent-hi hover:underline">
            playground
          </Link>
          .
        </p>
        {/* The one line that saves a small-business visitor from reading an
            API reference to find out it was never for them. */}
        <p className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
          Just need to send an invoice? You do not need any of this: {' '}
          <Link href="/invoice-generator" className="font-medium text-accent-hi hover:underline">
            create one with the invoice builder
          </Link>{' '}
          instead. It uses the same engine documented on this page, with none of the setup.
        </p>

        <H2 id="quickstart">Quickstart</H2>
        <p className="text-sm leading-relaxed text-muted">
          <strong className="text-text">1. Install the library.</strong> Validation, generation and
          repair run locally: no key, no account, no network:
        </p>
        <Code>{`npm install @stampbench/core`}</Code>
        <Code>{`import { validateXml } from '@stampbench/core';

const result = validateXml(xml, { profile: 'xrechnung' });

result.valid;                       // boolean
result.meta.rulesRun;               // how many rules produced that verdict
for (const v of result.violations) {
  console.error(v.ruleId, v.severity, v.message, v.line);
}`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          <strong className="text-text">2. Or call the hosted API.</strong> Anonymous calls are
          allowed (10/hour per IP), so you can try it before signing up:
        </p>
        <LangTabs
          samples={[
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -s https://stampbench.com/api/v1/validate \\
  -H "Content-Type: application/xml" \\
  --data-binary @invoice.xml`,
            },
            {
              id: 'ts',
              label: 'TypeScript',
              code: `const res = await fetch('https://stampbench.com/api/v1/validate', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.STAMPBENCH_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ xml, profile: 'xrechnung' }),
});
const { valid, violations } = await res.json();`,
            },
            {
              id: 'python',
              label: 'Python',
              code: `import os, requests

res = requests.post(
    "https://stampbench.com/api/v1/validate",
    headers={"Authorization": f"Bearer {os.environ['STAMPBENCH_API_KEY']}"},
    json={"xml": xml, "profile": "xrechnung"},
)
result = res.json()
for v in result["violations"]:
    print(v["ruleId"], v["message"])`,
            },
            {
              id: 'php',
              label: 'PHP',
              code: `$ch = curl_init('https://stampbench.com/api/v1/validate');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer ' . getenv('STAMPBENCH_API_KEY'),
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => json_encode(['xml' => $xml, 'profile' => 'xrechnung']),
]);
$result = json_decode(curl_exec($ch), true);`,
            },
          ]}
        />
        <p className="text-sm leading-relaxed text-faint">
          These are plain HTTPS calls, not SDKs: the only published package is{' '}
          <code className="font-mono">@stampbench/core</code> for JavaScript and TypeScript. Any
          language that can post JSON can use the API.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {IS_STATIC ? (
            <>Keys are issued from your <Link href="/account" className="text-accent-hi hover:underline">account page</Link>; if the hosted API is not yet switched on for you, email <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">hello@stampbench.com</a>. The library and CLI need no account at all.</>
          ) : (
            <>For real usage, <Link href="/register" className="text-accent-hi hover:underline">create a free account</Link>, generate an API key in the dashboard, and send it as a Bearer token.</>
          )}
        </p>

        <H2 id="regression">Regression testing against a future rule set</H2>
        <p className="text-sm leading-relaxed text-muted">
          E-invoicing rule sets change on a published cadence, and standards bodies release the
          artefacts <em>before</em> they become legally binding. That gap is your opportunity: you
          can find out which of your invoices will start failing while you still have time to fix
          them, instead of on the switchover date.
        </p>
        <Code>{`# Which rule sets can I compare?
npx stampbench rulesets

# Will my invoices survive the German rules?
npx stampbench regress ./invoices --from en16931@2017 --to xrechnung@3.0`}</Code>
        <Code>{`en16931@2017 → xrechnung@3.0  (40 → 56 rules)

3 documents would START failing under XRechnung 3.0.

Fix these rules first (most documents affected):
  BR-DE-15     3 documents  Missing buyer reference (BT-10)…
  BR-DE-2      3 documents  XRechnung requires a seller contact (BG-6)…

Affected documents:
  invoices/eu-invoice-001.xml  BR-DE-2, BR-DE-5, BR-DE-6, BR-DE-7, BR-DE-15

5 checked · 3 regressions · 0 improvements · 2 unchanged pass · 0 unchanged fail`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          It exits <code className="font-mono">1</code> when anything regresses, so you can drop it
          into CI and fail the build the day a new rule set is published: long before it is
          enforced. Add <code className="font-mono">--json</code> for a machine-readable report
          (per-document transitions plus rules ranked by how many documents they break).
        </p>
        <p className="text-sm leading-relaxed text-muted">
          The same machinery works in the library, including against a rule set you register
          yourself: a newly published specification, or your own house rules:
        </p>
        <Code>{`import { compareRulesets, registerRuleset, getRuleset } from '@stampbench/core';

const report = compareRulesets(documents, 'en16931@2017', 'xrechnung@3.0');
report.summary.regressions;  // documents that pass today and would not tomorrow
report.byNewRule;            // ranked: fix the top one for the biggest win

// Register a new specification release the day it is published
registerRuleset({
  id: 'xrechnung@3.1',
  label: 'XRechnung 3.1',
  profile: 'xrechnung',
  specVersion: 'XRechnung 3.1',
  status: 'candidate',          // published, not yet binding
  effectiveFrom: '2027-01-01',
  rules: [...getRuleset('xrechnung@3.0').rules, ...myNewRules],
});`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          Superseded rule sets stay registered too, so you can answer an audit question like
          &ldquo;would this invoice have been valid when we issued it?&rdquo; by validating against
          the version that was in force at the time.
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
          <strong className="text-text">CII</strong> (ZUGFeRD / Factur-X XML: what German
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
  "meta": { "rulesRun": 56, "rulesetVersion": "2026-08.2" }
}`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          Query/body parameter <code className="font-mono">profile</code>:{' '}
          <code className="font-mono">xrechnung</code> (default, 56 rules: the European core plus
          the German BR-DE rules) or <code className="font-mono">en16931</code> (40 rules, the
          European core alone). <code className="font-mono">meta.rulesRun</code> in the response
          always states which of the two actually ran, so a verdict is never ambiguous about the
          ruleset behind it. See{' '}
          <Link href="/markets" className="text-accent-hi hover:underline">
            markets
          </Link>{' '}
          for which profile applies where.
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

        <H2 id="payment-webhook">Payment webhook</H2>
        <p className="text-sm leading-relaxed text-muted">
          Auto-invoicing, for paid plans: generate a secret webhook URL on your{' '}
          <Link href="/account" className="text-accent-hi hover:underline">
            account page
          </Link>{' '}
          and point your payment provider: or anything that can POST JSON: at it. A payment that
          names one of your invoice numbers marks that invoice paid; anything else becomes a draft
          invoice in your saved list, ready to complete. The URL is the authentication: treat it
          like a password, and rotate it from the account page if it leaks.
        </p>
        <Code>{`POST https://stampbench.com/api/hooks/payment/sbwh_…your-token…`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          Native <strong className="text-text">Stripe</strong> events (
          <code className="font-mono text-xs">checkout.session.completed</code>,{' '}
          <code className="font-mono text-xs">payment_intent.succeeded</code>,{' '}
          <code className="font-mono text-xs">invoice.paid</code>) and{' '}
          <strong className="text-text">PayPal</strong> events (
          <code className="font-mono text-xs">PAYMENT.CAPTURE.COMPLETED</code>,{' '}
          <code className="font-mono text-xs">PAYMENT.SALE.COMPLETED</code>) are understood as-is:
          add the URL as a webhook endpoint in their dashboards. From anywhere else, send the
          generic shape; only <code className="font-mono text-xs">amount</code> and{' '}
          <code className="font-mono text-xs">currency</code> are required:
        </p>
        <Code>{`{
  "amount": "149.50",          // major units; number or string
  "currency": "GBP",           // ISO 4217
  "invoiceNumber": "INV-2026-000042",  // optional: matches & marks paid
  "payerName": "Acme GmbH",    // optional
  "payerEmail": "ap@acme.de",  // optional
  "description": "August retainer",    // optional: becomes the line item
  "id": "pay_8f3k2",           // optional: makes retries idempotent
  "date": "2026-08-25"         // optional
}

// Response
{ "ok": true, "action": "created" }     // or "marked_paid", "already_paid",
                                        // "duplicate", "ignored"`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          Deliveries are idempotent: a retried event with the same id lands as{' '}
          <code className="font-mono text-xs">duplicate</code> rather than a second invoice.
          Unrecognised event types answer <code className="font-mono text-xs">200</code> with{' '}
          <code className="font-mono text-xs">{'"action": "ignored"'}</code> so providers do not
          retry them forever. Auto-created invoices arrive marked paid, with the payment amount as
          a single zero-VAT line and a note saying where they came from: review the details and
          VAT before sending one to a customer.
        </p>

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
              <tr className="border-t border-border"><td className="px-4 py-2">Anonymous</td><td className="px-4 py-2">10 / hour / IP</td><td className="px-4 py-2">: </td></tr>
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
          <code className="font-mono text-accent-hi">@stampbench/core</code> (MIT) runs the same
          validation and generation locally: unlimited, offline, free forever:
        </p>
        <Code>{`npm install @stampbench/core

import {
  validateUblXml,       // XML → violations
  validateInvoice,      // semantic model → violations
  generateXRechnungUbl, // semantic model → XRechnung UBL
  withComputedTotals,   // fills BG-22 totals + BG-23 VAT breakdown
} from '@stampbench/core';

const result = validateUblXml(xml, { profile: 'xrechnung' });
if (!result.valid) console.table(result.violations);`}</Code>
        <p className="text-sm leading-relaxed text-muted">
          The hosted API adds always-current rules, AI explanations, cross-language access, usage
          history, and zero maintenance.
        </p>

        <H2 id="rules">Rules coverage</H2>
        <p className="text-sm leading-relaxed text-muted">
          Stampbench implements a documented, growing subset of the official rule sets: currently:
        </p>
        <ul className="my-3 list-disc pl-5 text-sm leading-relaxed text-muted">
          <li>EN 16931 structural rules: BR-01…BR-16, per-line BR-21…BR-27, BR-CO-04</li>
          <li>Totals &amp; VAT arithmetic: BR-CO-10, -13, -14, -15, -16, -17, -18, -25</li>
          <li>
            VAT category families: BR-S, BR-Z, BR-E, BR-AE, BR-K, BR-G, BR-O: breakdown
            presence, rate constraints, per-category taxable/VAT arithmetic, exemption reasons
          </li>
          <li>XRechnung (German CIUS): BR-DE-1…9, BR-DE-15, BR-DE-16, BR-DE-17, BR-DE-21, plus credit-transfer/IBAN checks</li>
          <li>Format &amp; code-list diagnostics (IG-* rule ids): ISO dates, currency/country codes, UNCL 5305 VAT categories</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          Syntax coverage: <strong className="text-text">UBL and CII</strong> (ZUGFeRD/Factur-X
          XML) for validation, UBL for generation. Every result is version-pinned to the spec
          release it was checked against (EN 16931-1:2017, XRechnung 3.0: see{' '}
          <code className="font-mono">meta.specVersions</code>). Stampbench is developer tooling,
          not legal advice: for certification-grade sign-off, also run the official KoSIT
          validator in CI. Our goal is that by the time you run it, it passes: and we publish our
          divergence from the KoSIT validator rather than asking you to take that on faith.
        </p>
      </article>
    </div>
  );
}

import Link from 'next/link';
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';


const HERO_SNIPPET = `import { validateUblXml } from '@stampbench/core';

const result = validateUblXml(xml);
// {
//   valid: false,
//   violations: [{
//     ruleId: "BR-DE-15",
//     severity: "error",
//     message: "Missing buyer reference (BT-10).
//       For German public-sector buyers this
//       is the Leitweg-ID…"
//   }]
// }`;

const features = [
  {
    title: 'Validation that explains itself',
    body: 'EN 16931 core rules, the full VAT category families (BR-S/E/AE/Z/G/O), and the German XRechnung profile (BR-DE). Every violation carries the rule id, the business term, and a message written for developers — with optional AI-written fix suggestions.',
  },
  {
    title: 'Totals computed by construction',
    body: 'Send lines with quantities, prices and VAT categories. Stampbench derives BT-106 through BT-115 and the VAT breakdown so the BR-CO arithmetic rules pass every time — the part hand-rolled generators always get wrong.',
  },
  {
    title: 'Open source where it counts',
    body: 'The full rule engine is MIT-licensed — validate and generate locally, unlimited, forever. The hosted platform sells what code alone can’t promise: always-current rules without dependency upgrades, volume, and compliance posture.',
  },
  {
    title: 'Know what breaks before it breaks',
    body: 'Rule sets change on a published schedule — and the artefacts land before they become binding. Point Stampbench at your invoices, diff them against the next rule set, and get a ranked list of what to fix. Nobody else lets you test the future; they just switch the rules on you.',
  },
  {
    title: 'Built for the mandate wave',
    body: 'Germany requires all companies to receive e-invoices since 2025 and to issue them from 2027. France and others follow. Ship compliance now, before your customers ask.',
  },
  {
    title: 'Reads what Germany actually sends',
    body: 'Both syntaxes, auto-detected: UBL and CII — the ZUGFeRD/Factur-X XML that most German e-invoices arrive as. POST XML, get structured violations back in milliseconds. Anonymous trial calls need no signup.',
  },
  {
    title: 'One endpoint to generate',
    body: 'POST clean JSON, get compliant XRechnung UBL back. Factur-X PDF generation (embedded XML), Peppol BIS and FatturaPA are next on the roadmap.',
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="hero-grid relative">
        {/* relative keeps the content painting above the ::before grid layer */}
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-24 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Germany&apos;s B2B e-invoicing mandate: issuing required from Jan 2027
            </div>
            <h1 className="mb-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Pass the e-invoice mandate.
              <br />
              <span className="bg-gradient-to-r from-accent-hi to-accent bg-clip-text text-transparent">
                In TypeScript.
              </span>
            </h1>
            <p className="mb-8 max-w-md text-lg leading-relaxed text-text/90">
              Open-source validation and generation for XRechnung / EN 16931 — plus a hosted
              platform that keeps you current as the rules change. Built to match the official
              KoSIT validator, with cryptic rule violations turned into plain-language fixes.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/playground"
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-hi"
              >
                Try the playground
              </Link>
              <Link
                href="/docs"
                className="rounded-lg border border-border bg-surface px-5 py-2.5 font-medium transition hover:border-border-hi"
              >
                Read the docs
              </Link>
            </div>
            <div className="mt-8 font-mono text-sm text-faint">
              npm install <span className="text-accent-hi">@stampbench/core</span>
            </div>
          </div>
          <div className="rounded-xl border border-border-hi bg-surface shadow-2xl shadow-accent/10">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
              <span className="ml-3 font-mono text-xs text-muted">validate.ts</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-text">
              {HERO_SNIPPET}
            </pre>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="border-t border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">
            The official validator says <span className="font-mono text-danger">[BR-DE-15]</span>.
            Now what?
          </h2>
          <p className="mb-12 max-w-2xl leading-relaxed text-muted">
            Millions of European businesses are being forced onto structured e-invoices, and the
            tooling assumes you enjoy reading Schematron. The reference stack is Java, the error
            messages cite clauses instead of fields, and one wrong VAT rounding rejects the whole
            document. Stampbench is the layer that makes it just work.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
                <h3 className="mb-2 font-medium">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API demo */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">Two calls, full compliance</h2>
          <p className="mb-10 max-w-2xl text-muted">
            No SDK lock-in, no XML expertise required. Anonymous trial calls work straight from your
            terminal.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3 font-mono text-xs text-muted">
                POST /api/v1/validate
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-muted">
{`curl -s https://stampbench.com/api/v1/validate \\
  -H "Content-Type: application/xml" \\
  --data-binary @invoice.xml

{
  "valid": false,
  "errorCount": 2,
  "violations": [
    { "ruleId": "BR-DE-15", "severity": "error",
      "message": "Missing buyer reference (BT-10)…" },
    { "ruleId": "BR-CO-15", "severity": "error",
      "message": "Total with VAT (BT-112) should be
                  1130.50 but is 1140.50." }
  ]
}`}
              </pre>
            </div>
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3 font-mono text-xs text-muted">
                POST /api/v1/generate
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-muted">
{`curl -s https://stampbench.com/api/v1/generate \\
  -H "Content-Type: application/json" \\
  -d '{ "invoice": {
        "number": "RE-2026-0043",
        "seller": { … }, "buyer": { … },
        "lines": [{ "quantity": 12,
          "price": { "netPrice": 120 },
          "vat": { "categoryCode": "S", "rate": 19 }}]
      }}'

{ "xml": "<?xml version=\\"1.0\\" …",
  "validation": { "valid": true } }`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">
            Don&apos;t take our word for it
          </h2>
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">
            A compliance tool is only worth using if it is right. Here is what we actually test —
            with the numbers, and the three documents we currently flag, published openly.
          </p>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { figure: '57', label: 'Automated tests passing', sub: 'Library, CLI and API' },
              { figure: '86', label: 'Official test documents run', sub: '45 UBL + 41 CII, 0 crashes' },
              { figure: '56', label: 'Validation rules active', sub: 'EN 16931 + VAT families + BR-DE' },
              { figure: '25', label: 'Review findings triaged', sub: 'Adversarially verified' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface p-5">
                <div className="text-2xl font-semibold tracking-tight text-accent-hi">{s.figure}</div>
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
              See the full test evidence →
            </Link>
            <Link
              href="/security"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition hover:border-border-hi"
            >
              Security practices →
            </Link>
            <span className="text-sm text-faint">
              MIT-licensed engine — run it locally, verify every number yourself.
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-3 text-3xl font-semibold tracking-tight">
            Be compliant before your competitors are.
          </h2>
          <p className="mx-auto mb-8 max-w-md text-muted">
            Free plan with 100 API calls a month. Unlimited local validation with the open-source
            library, forever.
          </p>
          <Link
            href={IS_STATIC ? 'https://www.npmjs.com/package/stampbench' : '/register'}
            className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-accent-hi"
          >
            {IS_STATIC ? 'Get it on npm' : 'Start free'}
          </Link>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Integration documentation',
  description:
    'Install the MIT-licensed Stampbench TypeScript engine, validate UBL or CII locally and return structured EN 16931 and XRechnung findings.',
  alternates: { canonical: '/docs' },
};

function Code({ children }: { children: string }) {
  return (
    <pre className="my-5 overflow-x-auto border border-white/10 bg-[#111317] p-5 font-mono text-xs leading-6 text-[#c8cbc2]">
      {children}
    </pre>
  );
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="mt-14 scroll-mt-24 text-2xl font-semibold tracking-[-0.035em]">{children}</h2>;
}

const installExample = `npm install @stampbench/core`;

const validationExample = `import { locateViolations, validateXml } from '@stampbench/core';

const result = validateXml(xml, { profile: 'xrechnung' });
const findings = locateViolations(
  xml,
  result.violations,
  result.syntax ?? 'ubl',
);

for (const finding of findings) {
  console.log({
    ruleId: finding.ruleId,
    severity: finding.severity,
    message: finding.message,
    line: finding.location.line,
    column: finding.location.column,
    precision: finding.location.precision,
    terms: finding.terms,
  });
}`;

const cliExample = `npx stampbench validate invoice.xml
npx stampbench validate ./invoices --profile en16931 --json
npx stampbench validate ./invoices --format sarif > stampbench.sarif`;

const resultExample = `{
  "valid": false,
  "syntax": "ubl",
  "profile": "xrechnung",
  "violations": [{
    "ruleId": "BR-CO-10",
    "severity": "error",
    "terms": ["BT-106", "BT-131"],
    "location": {
      "line": 40,
      "column": 7,
      "precision": "exact"
    }
  }]
}`;

export default function DocsPage() {
  return (
    <main className="bg-[#f4efe3] px-5 py-14 text-[#20231f] sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[210px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 border-t border-[#20231f]/20 pt-4 text-sm text-[#5f625b]" aria-label="Documentation sections">
            <a href="#install" className="block py-2 hover:text-[#20231f]">Install</a>
            <a href="#validate" className="block py-2 hover:text-[#20231f]">Validate locally</a>
            <a href="#result" className="block py-2 hover:text-[#20231f]">Result contract</a>
            <a href="#cli" className="block py-2 hover:text-[#20231f]">CLI and CI</a>
            <a href="#coverage" className="block py-2 hover:text-[#20231f]">Current coverage</a>
            <a href="#pilot" className="block py-2 hover:text-[#20231f]">Integration pilot</a>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#c7442d]">@stampbench/core / integration reference</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">Validate inside the software you already operate.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#5f625b]">The public integration surface is the MIT-licensed TypeScript library and command-line tool. Both run locally, require no Java runtime and do not require invoice bytes to leave your process.</p>
          <div className="mt-8 flex flex-wrap gap-5 text-sm">
            <Link href="/playground" className="rounded-[4px] bg-[#20231f] px-5 py-3 font-semibold text-[#fdfbf7]">Test an invoice ↗</Link>
            <a href="https://github.com/harveylegge/stampbench" className="border-b border-[#20231f] py-3 font-medium">View source ↗</a>
          </div>

          <Heading id="install">Install</Heading>
          <p className="mt-3 text-sm leading-6 text-[#5f625b]">Use Node.js 20 or later. The core package depends on <code className="font-mono text-xs">fast-xml-parser</code> and <code className="font-mono text-xs">zod</code>; npm installs them with the package.</p>
          <Code>{installExample}</Code>

          <Heading id="validate">Validate UBL or CII locally</Heading>
          <p className="mt-3 text-sm leading-6 text-[#5f625b]">The syntax is auto-detected. Select <code className="font-mono text-xs">en16931</code> for the European core subset or <code className="font-mono text-xs">xrechnung</code> for that core plus the implemented German rules.</p>
          <Code>{validationExample}</Code>

          <Heading id="result">Result contract</Heading>
          <p className="mt-3 text-sm leading-6 text-[#5f625b]">Findings expose stable rule identifiers and business terms. Location precision is explicit: an absent field may resolve to its nearest existing ancestor rather than an invented exact line.</p>
          <Code>{resultExample}</Code>

          <Heading id="cli">CLI and CI</Heading>
          <p className="mt-3 text-sm leading-6 text-[#5f625b]">The CLI returns exit code 1 for validation failures and supports JSON, GitHub annotation and SARIF output for build pipelines.</p>
          <Code>{cliExample}</Code>

          <Heading id="coverage">Current coverage</Heading>
          <div className="mt-5 border-t border-[#20231f]/20 text-sm">
            {[
              ['Syntaxes', 'UBL 2.1 and UN/CEFACT CII validation; UBL generation'],
              ['European profile', '40 implemented EN 16931 core rules'],
              ['German profile', '16 additional BR-DE rules; 56 rules in the current XRechnung profile'],
              ['Evidence corpus', '86 exercised documents: 45 UBL and 41 CII'],
              ['Ruleset labels', 'EN 16931-1:2017 and XRechnung 3.0'],
            ].map(([term, value]) => (
              <div key={term} className="grid gap-2 border-b border-[#20231f]/15 py-4 sm:grid-cols-[180px_1fr]">
                <strong>{term}</strong><span className="text-[#5f625b]">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-[#5f625b]">This is documented subset coverage, not complete KoSIT parity, certification, legal advice or a guarantee that every recipient will accept a document. See the <Link href="/trust" className="border-b border-[#20231f]/40 text-[#20231f]">validation evidence</Link> before making an integration decision.</p>

          <Heading id="pilot">Fixed-scope integration pilot</Heading>
          <p className="mt-3 text-sm leading-6 text-[#5f625b]">Teams that want implementation help can evaluate a £3,000 pilot covering one staging workflow, agreed representative documents, structured diagnostic mapping and a written handover. The price is an early commercial hypothesis and the scope is agreed before work starts.</p>
          <a href="mailto:hello@stampbench.com?subject=Stampbench%20integration%20pilot" className="mt-6 inline-block border-b border-[#20231f] pb-1 text-sm font-medium">Discuss a pilot ↗</a>
        </article>
      </div>
    </main>
  );
}

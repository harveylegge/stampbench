import type { Metadata } from 'next';
import Link from 'next/link';

import { InvoiceGenerator } from '@/components/invoice/generator';
import { PAGE_MARKETS, MARKETS, RULE_COUNTS } from '@/lib/markets';

export const metadata: Metadata = {
  title: 'Invoice generator — create and validate structured invoices',
  description:
    'Create a structured invoice for the UK, Germany, the EU or the US, then validate it against EN 16931 or the German XRechnung profile in the same step. Exact arithmetic, UBL and JSON export, open source, runs in your browser.',
  alternates: { canonical: '/invoice-generator' },
  openGraph: {
    title: 'Stampbench invoice generator',
    description:
      'Create, validate, repair and export structured invoices for the market you bill — EN 16931 and XRechnung, in the browser.',
  },
};

export default function InvoiceGeneratorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">Invoice generator</h1>
        <p className="leading-relaxed text-muted">
          Build an invoice, and Stampbench validates it against the ruleset for your market in the same
          step — {RULE_COUNTS.en16931} rules for the European core, {RULE_COUNTS.xrechnung} for the German
          profile. Totals are computed in exact minor units, the structured document is the deliverable,
          and nothing leaves your browser.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-faint">
          Per-market detail:{' '}
          {PAGE_MARKETS.map((id, index) => (
            <span key={id}>
              {index > 0 && ' · '}
              <Link href={`/invoice-generator/${id}`} className="text-accent-hi hover:underline">
                {MARKETS[id].name}
              </Link>
            </span>
          ))}
        </p>
      </div>
      <InvoiceGenerator />
    </div>
  );
}

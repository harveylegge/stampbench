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

/**
 * The invoice comes first.
 *
 * Everything explanatory sits below the editor: someone who arrived here wants
 * to make an invoice, and a screen of prose before the first field is a toll
 * gate. The detail is still on the page for anyone who scrolls, which is also
 * where a search engine expects to find it.
 */
export default function InvoiceGeneratorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">Create an invoice</h1>

      <InvoiceGenerator />

      <section className="mt-16 border-t border-border pt-10">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-lg font-semibold tracking-tight">What this does</h2>
            <p className="text-sm leading-relaxed text-muted">
              Build the invoice, and Stampbench checks it against the ruleset for your market in the same
              step — {RULE_COUNTS.en16931} rules for the European core, {RULE_COUNTS.xrechnung} for the
              German profile. Totals are computed in exact minor units, so the figure on screen is the
              figure in the file.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold tracking-tight">Where it runs</h2>
            <p className="text-sm leading-relaxed text-muted">
              In your browser. The engine is an open-source npm package, so the invoice is never uploaded
              and the draft is kept only in this browser. No account is needed to create, validate or
              export one.
            </p>
          </div>
        </div>

        <p className="mt-8 text-sm text-faint">
          Per-market detail:{' '}
          {PAGE_MARKETS.map((id, index) => (
            <span key={id}>
              {index > 0 && ' · '}
              <Link href={`/invoice-generator/${id}`} className="text-accent-hi hover:underline">
                {MARKETS[id].name}
              </Link>
            </span>
          ))}
          <span className="mx-2">·</span>
          <Link href="/playground" className="text-accent-hi hover:underline">
            Validate an invoice you already have
          </Link>
        </p>
      </section>
    </div>
  );
}

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
      <h1 className="mb-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">Create an invoice</h1>
      {/* One line, and it answers the three questions a first-time visitor
          actually has: is this free, will it work, where does my data go. It
          does not name a standard — the point of this page is that they never
          have to learn one. */}
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted">
        Add your business, customer and work details. We handle the totals and prepare a PDF ready
        to send. Free, no account needed, and your draft stays in your browser.
      </p>

      <InvoiceGenerator />

      <section className="mt-16 border-t border-border pt-10">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-lg font-semibold tracking-tight">What this does</h2>
            <p className="text-sm leading-relaxed text-muted">
              You fill in your details, your customer and what you are charging for. Stampbench works
              out the VAT and the totals exactly, checks the invoice against the e-invoicing
              requirements that apply where you bill, and tells you in plain English if anything is
              missing — before you send it.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold tracking-tight">Where it runs</h2>
            <p className="text-sm leading-relaxed text-muted">
              In your browser. The invoice is never uploaded, and the draft is kept only on this
              device. No account is needed to create one, check it or download it.
            </p>
          </div>
        </div>

        {/* The technical account of the same paragraph, for whoever wants it —
            and the bridge to the developer product, stated once. */}
        <details className="mt-8 rounded-xl border border-border bg-surface p-5">
          <summary className="cursor-pointer list-none text-sm font-medium">
            Technical details
            <span className="ml-1.5 text-xs font-normal text-faint">
              standards, rules and formats
            </span>
          </summary>
          <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm leading-relaxed text-muted">
            <p>
              Invoices are validated against EN 16931 — {RULE_COUNTS.en16931} rules in the European
              core profile, {RULE_COUNTS.xrechnung} under the German XRechnung 3.0 CIUS, selected by
              the market you chose. Output is UBL 2.1. Totals and the VAT breakdown are computed in
              exact minor units from your lines, so the BR-CO arithmetic rules pass by construction
              and the figure on screen is the figure in the file.
            </p>
            <p>
              The engine is <code className="font-mono text-xs">@stampbench/core</code>, an
              MIT-licensed npm package running client-side on this page. The same validation and
              generation are available as a library, a CLI and a hosted REST API —{' '}
              <Link href="/developers" className="text-accent-hi hover:underline">
                see the developer platform
              </Link>
              .
            </p>
          </div>
        </details>

        <p className="mt-6 text-sm text-faint">
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Flag } from '@/components/flag';
import { InvoiceGenerator } from '@/components/invoice/generator';
import { formatsForMarket, isUsable, SUPPORT_LABEL } from '@/lib/invoice/formats';
import { getCountry } from '@/lib/invoice/countries';
import { defaultCountryFor } from '@/lib/invoice/draft';
import { MARKETS, PAGE_MARKETS, rulesetFor, type MarketId } from '@/lib/markets';

/**
 * Per-market generator pages.
 *
 * Four, not forty. Each one exists because there is something specific and
 * true to say about generating an invoice for that market — which ruleset
 * runs, which fields the forms ask for, what is not implemented — and the
 * generator underneath opens on that market. A page that only differed by a
 * country name in the heading would be exactly the thin SEO page this product
 * has no business publishing.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return PAGE_MARKETS.map((market) => ({ market }));
}

const META: Record<string, { title: string; description: string }> = {
  uk: {
    title: 'UK invoice generator — create and validate EN 16931 invoices',
    description:
      'Create a UK invoice with sterling amounts, sort code and account number, and validate it against EN 16931. Exact arithmetic, UBL and JSON export, free and in your browser. No UK-specific ruleset is claimed.',
  },
  germany: {
    title: 'XRechnung generator — create and validate German e-invoices',
    description:
      'Create an XRechnung 3.0 invoice with the Leitweg-ID, IBAN and BIC, then validate it against all 56 rules of the German CIUS — the European core plus the BR-DE profile. Free, open source, runs in your browser.',
  },
  eu: {
    title: 'EN 16931 invoice generator for the European Union',
    description:
      'Create an EN 16931 invoice in UBL 2.1 for any EU market, with reverse-charge and intra-community VAT categories, and validate it against the 40 core rules in the same step.',
  },
  us: {
    title: 'US invoice generator — commercial and EN 16931 invoices',
    description:
      'Create a US business invoice with state, ZIP and routing number, or an EN 16931 document for European customers. Sales tax is entered manually — Stampbench does not determine US tax rates.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<Metadata> {
  const { market } = await params;
  const meta = META[market];
  if (!meta) return {};
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/invoice-generator/${market}` },
    openGraph: { title: `${meta.title} · Stampbench`, description: meta.description },
  };
}

export default async function MarketGeneratorPage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market: slug } = await params;
  if (!PAGE_MARKETS.includes(slug as MarketId)) notFound();

  const id = slug as MarketId;
  const market = MARKETS[id];
  const ruleset = rulesetFor(id);
  const formats = formatsForMarket(id);
  const country = getCountry(defaultCountryFor(id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-faint">
        <Link href="/invoice-generator" className="transition hover:text-muted">
          Invoice generator
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="text-muted">{market.name}</span>
      </nav>

      <div className="mb-8 max-w-2xl">
        <div className="mb-4 text-muted">
          <Flag code={market.flag} size={34} />
        </div>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Invoice generator for {market.name}
        </h1>
        <p className="leading-relaxed text-muted">{market.stance}</p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 text-xs uppercase tracking-[0.12em] text-faint">Validated against</div>
          <div className="text-sm font-medium">{ruleset.label}</div>
          <div className="font-mono text-xs text-faint">
            {ruleset.id} · {ruleset.ruleCount} rules
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 text-xs uppercase tracking-[0.12em] text-faint">Form adapts to</div>
          <div className="text-sm font-medium">{country.name || 'Your chosen country'}</div>
          <div className="text-xs text-faint">
            {country.address.postCodeLabel}
            {country.address.subdivisionLabel ? `, ${country.address.subdivisionLabel}` : ''} ·{' '}
            {country.bank === 'uk'
              ? 'sort code + account number'
              : country.bank === 'us'
                ? 'routing + account number'
                : 'IBAN + BIC'}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 text-xs uppercase tracking-[0.12em] text-faint">Exports</div>
          <div className="text-sm font-medium">
            {[...new Set(formats.filter(isUsable).flatMap((f) => f.outputs))]
              .map((o) => (o === 'print' ? 'PDF (print)' : o.toUpperCase()))
              .join(' · ')}
          </div>
          <div className="text-xs text-faint">Structured document first, printable view second.</div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Formats available here</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {formats.map((format) => (
            <div
              key={format.id}
              className={`rounded-xl border p-4 ${
                isUsable(format) ? 'border-border bg-surface' : 'border-border bg-surface-2/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{format.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    format.support === 'supported'
                      ? 'bg-success/15 text-success'
                      : format.support === 'partial'
                        ? 'bg-warning/15 text-warning'
                        : 'bg-surface-2 text-faint'
                  }`}
                >
                  {SUPPORT_LABEL[format.support]}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{format.detail}</p>
              {format.limitation && (
                <p className="mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-faint">
                  {format.limitation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 border-t border-border pt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Create the invoice</h2>
      </div>
      <InvoiceGenerator initialMarket={id} />

      <div className="mt-12 border-t border-border pt-6 text-sm text-faint">
        <Link href={`/markets/${id}`} className="text-accent-hi hover:underline">
          What else Stampbench covers for {market.name}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/docs" className="text-accent-hi hover:underline">
          API documentation
        </Link>
        <span className="mx-2">·</span>
        <Link href="/playground" className="text-accent-hi hover:underline">
          Validate an invoice you already have
        </Link>
      </div>
    </div>
  );
}

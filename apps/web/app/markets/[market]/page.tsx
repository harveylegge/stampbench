import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Flag } from '@/components/flag';
import { MarketCta } from '@/components/market-cta';
import {
  CAPABILITIES,
  MARKETS,
  PAGE_MARKETS,
  rulesetFor,
  type CapabilityStatus,
  type MarketId,
} from '@/lib/markets';

/**
 * One page per market with real product substance — the ruleset that runs, the
 * capabilities that apply, and an explicit list of what is not implemented.
 * Four pages, not forty: a market gets a page when there is something true to
 * say about it, and "we have nothing country-specific for you yet, here is
 * what still helps" is something true to say.
 *
 * This is also where jurisdiction keywords belong. The homepage is deliberately
 * market-neutral, so /markets/germany is what should rank for XRechnung in
 * English while /de keeps the German-language traffic.
 */

const META: Record<string, { title: string; description: string }> = {
  uk: {
    title: 'Invoice validation for UK businesses',
    description:
      'What Stampbench does for a UK business: EN 16931 validation, UBL and CII parsing, deterministic repair and invoice creation. No UK-specific ruleset is implemented — stated plainly rather than implied.',
  },
  us: {
    title: 'Invoice validation for US businesses',
    description:
      'What Stampbench does for a US business billing into Europe: EN 16931 validation, UBL and CII parsing, repair and structured invoice creation. No US ruleset and no sales-tax determination.',
  },
  eu: {
    title: 'EN 16931 invoice validation for the European Union',
    description:
      'Validate invoices against EN 16931-1:2017 — 40 core rules, UBL 2.1 and CII (ZUGFeRD / Factur-X) auto-detected — plus Germany’s XRechnung 3.0 profile. Which national customisations are implemented, and which are not.',
  },
  germany: {
    title: 'XRechnung and ZUGFeRD validation for Germany',
    description:
      'Validate XRechnung 3.0 and ZUGFeRD / Factur-X invoices against 56 rules: the EN 16931 core plus the German BR-DE profile, with the rule id, business term and failing line for every violation. Open source, runs locally.',
  },
};

/**
 * The four market slugs are the whole set — there is no such thing as a market
 * page we have not written. `dynamicParams: false` makes that explicit and is
 * what `output: 'export'` needs in order to prerender the route at all.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return PAGE_MARKETS.map((market) => ({ market }));
}

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
    alternates: { canonical: `/markets/${market}` },
    openGraph: { title: `${meta.title} · Stampbench`, description: meta.description },
  };
}

const GROUPS: { status: CapabilityStatus; heading: string; blurb: string; tone: string }[] = [
  {
    status: 'yes',
    heading: 'What works here today',
    blurb: 'Available now, no account needed to try any of it.',
    tone: 'text-success',
  },
  {
    status: 'context',
    heading: 'Available in a specific case',
    blurb: 'Implemented, but it only applies in the situation described.',
    tone: 'text-warning',
  },
  {
    status: 'no',
    heading: 'Not implemented',
    blurb: 'Listed so you can rule Stampbench out quickly if this is what you needed.',
    tone: 'text-faint',
  },
];

export default async function MarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: slug } = await params;
  if (!PAGE_MARKETS.includes(slug as MarketId)) notFound();

  const id = slug as MarketId;
  const market = MARKETS[id];
  const ruleset = rulesetFor(id);
  const others = PAGE_MARKETS.filter((m) => m !== id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-faint">
        <Link href="/markets" className="transition hover:text-muted">
          Markets
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="text-muted">{market.name}</span>
      </nav>

      <div className="mb-5 text-muted">
        <Flag code={market.flag} size={40} />
      </div>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">{market.headline}</h1>

      <div className="mb-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-muted">
        <span className="text-faint">Default ruleset</span>
        <span className="text-accent-hi">{ruleset.id}</span>
        <span className="text-faint">·</span>
        <span>{ruleset.label}</span>
        <span className="text-faint">·</span>
        <span>{ruleset.ruleCount} rules</span>
      </div>

      <p className="mb-6 max-w-2xl leading-relaxed text-muted">{market.stance}</p>

      <div className="mb-12 rounded-xl border border-accent/30 bg-accent-dim/30 p-6">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-accent-hi">
          Start here
        </h2>
        <p className="mb-5 max-w-2xl leading-relaxed text-text">{market.primaryUse}</p>
        <div className="flex flex-wrap gap-3">
          <MarketCta market={id}>Validate a {market.adjective} invoice</MarketCta>
          <MarketCta market={id} href="/docs" variant="secondary">
            Read the docs
          </MarketCta>
        </div>
      </div>

      {GROUPS.map((group) => {
        const rows = CAPABILITIES.filter((c) => market.capabilities[c.id].status === group.status);
        if (rows.length === 0) return null;
        return (
          <section key={group.status} className="mb-12">
            <h2 className={`mb-1 text-xl font-semibold tracking-tight ${group.tone}`}>
              {group.heading}
            </h2>
            <p className="mb-5 text-sm text-faint">{group.blurb}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((capability) => {
                const cell = market.capabilities[capability.id];
                return (
                  <div key={capability.id} className="rounded-xl border border-border bg-surface p-5">
                    <h3 className="mb-1.5 font-medium tracking-tight">{capability.name}</h3>
                    <p className="text-sm leading-relaxed text-muted">{capability.detail}</p>
                    {cell.note && (
                      <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-faint">
                        {cell.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="mb-12">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">On the command line</h2>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">
          The same engine, as an npm package. The header line names the ruleset that ran, so a
          result is never ambiguous about what it was measured against.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-border bg-surface p-5 font-mono text-xs leading-relaxed text-muted">
          {`$ npx stampbench validate invoice.xml --profile ${ruleset.profile}

invoice.xml  syntax: UBL | profile: ${ruleset.profile} | ruleset: 2026-08.2
  ERROR  BR-CO-17  VAT breakdown S @ 7%: tax amount should be
         22.04 (314.86 × 7%) but is 99.99. (line 78)
INVALID — 1 error, 0 warnings (${ruleset.ruleCount} rules run)`}
        </pre>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Other markets</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {others.map((other) => (
            <Link
              key={other}
              href={`/markets/${other}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-border-hi"
            >
              <span className="text-muted">
                <Flag code={MARKETS[other].flag} size={22} />
              </span>
              <span className="text-sm font-medium">{MARKETS[other].short}</span>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm text-faint">
          <Link href="/markets" className="text-accent-hi hover:underline">
            Compare every market side by side
          </Link>
          , gaps included.
        </p>
      </section>
    </div>
  );
}

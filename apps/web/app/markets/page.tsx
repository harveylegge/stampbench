import type { Metadata } from 'next';
import Link from 'next/link';

import { Flag } from '@/components/flag';
import {
  CAPABILITIES,
  MARKETS,
  PAGE_MARKETS,
  RULE_COUNTS,
  rulesetFor,
  type CapabilityStatus,
  type MarketId,
} from '@/lib/markets';

export const metadata: Metadata = {
  title: 'Markets — what Stampbench covers, and what it does not',
  description:
    'A side-by-side view of Stampbench coverage by market: EN 16931 core validation everywhere, the German XRechnung profile in full, and an explicit list of what is not implemented in the UK, the US or the rest of the EU.',
  alternates: { canonical: '/markets' },
};

/**
 * The multi-market view. Someone who bills into several countries does not
 * want four separate pages — they want the matrix, including the empty cells.
 * Publishing the gaps is the same instinct as publishing the three official
 * test documents we disagree with on /trust: the coverage claim is only worth
 * anything if the non-coverage is stated just as plainly.
 */

const SYMBOL: Record<CapabilityStatus, { mark: string; className: string; label: string }> = {
  yes: { mark: '✓', className: 'text-success', label: 'Available' },
  context: { mark: '~', className: 'text-warning', label: 'In a specific case' },
  no: { mark: '—', className: 'text-faint', label: 'Not implemented' },
};

function MarketColumnHead({ id }: { id: MarketId }) {
  const market = MARKETS[id];
  const ruleset = rulesetFor(id);
  return (
    <th scope="col" className="px-4 py-3 text-left align-bottom font-normal">
      <Link href={`/markets/${id}`} className="group block">
        <span className="mb-1.5 block text-muted">
          <Flag code={market.flag} size={24} />
        </span>
        <span className="block text-sm font-medium text-text group-hover:text-accent-hi">
          {market.short}
        </span>
        <span className="block font-mono text-[11px] font-normal text-faint">
          {ruleset.ruleCount} rules
        </span>
      </Link>
    </th>
  );
}

export default function MarketsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">Markets</h1>
      <p className="mb-4 max-w-2xl leading-relaxed text-muted">
        Invoice rules are set per jurisdiction, so &ldquo;does Stampbench work for me?&rdquo; has a
        different answer depending on where you bill. This is the whole matrix, gaps included.
      </p>
      <p className="mb-10 max-w-2xl text-sm leading-relaxed text-faint">
        Every market gets the {RULE_COUNTS.en16931} EN 16931 core rules, both XML syntaxes, repair
        and creation, because those are properties of the engine rather than of a country. What
        differs is whether a national customisation exists on top — today exactly one does.
      </p>

      {/* The table is wider than a phone; it scrolls inside its own box rather
          than widening the page. */}
      <div className="mb-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="bg-surface text-faint">
            <tr>
              <th scope="col" className="px-4 py-3 text-left align-bottom font-normal">
                Capability
              </th>
              {PAGE_MARKETS.map((id) => (
                <MarketColumnHead key={id} id={id} />
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability) => (
              <tr key={capability.id} className="border-t border-border align-top">
                <th scope="row" className="px-4 py-4 text-left font-normal">
                  <span className="block font-medium text-text">{capability.name}</span>
                  <span className="mt-1 block max-w-md text-xs leading-relaxed text-muted">
                    {capability.detail}
                  </span>
                </th>
                {PAGE_MARKETS.map((id) => {
                  const cell = MARKETS[id].capabilities[capability.id];
                  const symbol = SYMBOL[cell.status];
                  return (
                    <td key={id} className="px-4 py-4">
                      <span className={`font-mono text-base ${symbol.className}`} title={symbol.label}>
                        {symbol.mark}
                      </span>
                      <span className="sr-only">{symbol.label}</span>
                      {cell.note && (
                        <span className="mt-1 block max-w-[16rem] text-xs leading-relaxed text-faint">
                          {cell.note}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-14 flex flex-wrap gap-x-6 gap-y-2 text-xs text-faint">
        {(['yes', 'context', 'no'] as CapabilityStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-2">
            <span className={`font-mono ${SYMBOL[status].className}`}>{SYMBOL[status].mark}</span>
            {SYMBOL[status].label}
          </span>
        ))}
      </div>

      <h2 className="mb-4 text-xl font-semibold tracking-tight">Pick a market</h2>
      <div className="mb-14 grid gap-3 sm:grid-cols-2">
        {PAGE_MARKETS.map((id) => {
          const market = MARKETS[id];
          const ruleset = rulesetFor(id);
          return (
            <Link
              key={id}
              href={`/markets/${id}`}
              className="group rounded-xl border border-border bg-surface p-5 transition hover:border-border-hi hover:shadow-sm"
            >
              <span className="mb-3 block text-muted">
                <Flag code={market.flag} size={28} />
              </span>
              <span className="block font-medium tracking-tight">{market.name}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{market.tagline}</span>
              <span className="mt-3 block font-mono text-xs text-faint">
                {ruleset.label} · {ruleset.ruleCount} rules
              </span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent-dim/30 px-6 py-6">
        <h2 className="mb-2 text-lg font-semibold tracking-tight text-accent-hi">
          Why the empty cells are on this page
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          A compliance tool that overstates its coverage is worse than no tool at all: it turns
          &ldquo;invalid&rdquo; into &ldquo;quietly wrong&rdquo;. The same rule applies to markets as
          to invoice data — we publish what we have not implemented for the same reason we publish
          the official test documents where we disagree with the reference validator.{' '}
          <Link href="/trust" className="font-medium text-accent-hi hover:underline">
            See the test evidence
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

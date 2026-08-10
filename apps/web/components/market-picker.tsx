'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flag } from '@/components/flag';
import type { MarketsCopy } from '@/lib/copy';
import { onMarketChange, readMarket, writeMarket } from '@/lib/market-preference';
import { MARKETS, marketHref, PICKER_MARKETS, type MarketId } from '@/lib/markets';

/**
 * The homepage's central interaction: pick where you do business, and the site
 * starts answering for that market instead of for Germany.
 *
 * Each card is a real link to that market's page, so it works before the
 * JavaScript arrives and the choice is a normal navigation rather than a modal
 * state machine. The click additionally remembers the market for the
 * playground; nothing about that requires an account, and nothing leaves the
 * browser.
 */
export function MarketPicker({ copy }: { copy: MarketsCopy }) {
  const [current, setCurrent] = useState<MarketId | null>(null);

  // Rendered identically for everyone on the server, then reconciled on mount:
  // the selection lives in localStorage, which a static page cannot know about
  // at build time.
  useEffect(() => {
    const sync = () => setCurrent(readMarket());
    sync();
    return onMarketChange(sync);
  }, []);

  const cards = copy.cards.filter((c) => PICKER_MARKETS.includes(c.id));

  return (
    // scroll-mt clears the sticky header: the hero's secondary CTA is an
    // in-page jump, and landing with the heading tucked under the nav bar
    // would make the band look like it starts mid-sentence.
    <section id="markets" className="scroll-mt-14 border-t border-border bg-surface/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 max-w-2xl">
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-hi">
            {copy.eyebrow}
          </div>
          <h2 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.heading}</h2>
          <p className="leading-relaxed text-muted">{copy.body}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const isCurrent = current === card.id;
            return (
              <Link
                key={card.id}
                href={marketHref(card.id)}
                onClick={() => writeMarket(card.id)}
                aria-current={isCurrent ? 'true' : undefined}
                className={`group flex items-start gap-3 rounded-xl border bg-surface p-4 transition sm:flex-col sm:items-stretch sm:gap-0 sm:p-5 ${
                  isCurrent
                    ? 'border-accent/50 ring-1 ring-accent/20'
                    : 'border-border hover:border-border-hi hover:shadow-sm'
                }`}
              >
                <span className="mt-0.5 shrink-0 text-muted sm:mb-4 sm:mt-0">
                  <Flag code={MARKETS[card.id].flag} size={30} />
                </span>
                {/* flex-col + mt-auto on the link row keeps the four "What
                    works here →" lines on one baseline even though the
                    taglines are different lengths. */}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium tracking-tight">{card.name}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent-hi">
                        {copy.selected}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{card.tagline}</span>
                  <span className="mt-3 hidden items-center gap-1 text-sm font-medium text-accent-hi sm:mt-auto sm:flex sm:pt-3">
                    {copy.change}
                    <span
                      aria-hidden
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-faint">{copy.note}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/markets" className="font-medium text-accent-hi hover:underline">
              {copy.compare}
            </Link>
            <Link
              href="/markets/germany"
              onClick={() => writeMarket('germany')}
              className="inline-flex items-center gap-2 text-muted transition hover:text-text"
            >
              <Flag code="de" size={18} />
              {copy.germanyLink}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

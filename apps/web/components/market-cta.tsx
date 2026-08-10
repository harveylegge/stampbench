'use client';

import Link from 'next/link';
import { writeMarket } from '@/lib/market-preference';
import type { MarketId } from '@/lib/markets';

/**
 * A link into the playground that carries the market with it, so the visitor
 * is never asked the same question twice: choosing a market here means the
 * validator opens on the right ruleset instead of showing a second picker.
 *
 * A plain <Link>, so it still navigates with JavaScript disabled — the market
 * simply falls back to the default in that case, which is the correct
 * degradation for a preference.
 */
export function MarketCta({
  market,
  href = '/playground',
  children,
  variant = 'primary',
}: {
  market: MarketId;
  href?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const style =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-hi'
      : 'border border-border bg-surface hover:border-border-hi';
  return (
    <Link
      href={href}
      onClick={() => writeMarket(market)}
      className={`inline-block rounded-lg px-5 py-2.5 text-sm font-medium transition ${style}`}
    >
      {children}
    </Link>
  );
}

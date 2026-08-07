'use client';

import Link from 'next/link';
import { useState } from 'react';
import { localePath, type Copy } from '@/lib/copy';

/**
 * The hero's product visual: a validation panel a visitor can actually click.
 * One press of "Fix automatically" shows the honest outcome — the arithmetic
 * error is repaired, the missing buyer reference is NOT, because it has no
 * derivable value. That asymmetry is the product's whole differentiator, so
 * the demo leads with it rather than pretending everything is fixable.
 *
 * The numbers are the same real BR-CO-17 case as the CLI samples further down
 * the page (22.04 = 314.86 × 7%), so a visitor who tries the playground sees
 * the same behaviour the hero promised.
 */
export function HeroDemo({ copy }: { copy: Copy }) {
  const [fixed, setFixed] = useState(false);
  const demo = copy.heroDemo;

  return (
    <div className="overflow-hidden rounded-xl border border-border-hi bg-[#101014] text-[#e8e8ec] shadow-xl shadow-accent/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-mono text-xs text-white/60">rechnung.xml</span>
        <span className="flex items-center gap-3 font-mono text-xs">
          <span className="text-emerald-400">✓ 54 {demo.passed}</span>
          <span className={fixed ? 'text-amber-300' : 'text-red-400'}>
            ✗ {fixed ? 1 : 2} {demo.errors}
          </span>
        </span>
      </div>

      <div className="space-y-3 p-5 font-mono text-[13px] leading-relaxed">
        {/* BR-CO-17 — the derivable, fixable one */}
        <div
          className={`rounded-lg border p-3 transition-colors duration-500 ${
            fixed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className={fixed ? 'text-emerald-400' : 'text-red-400'}>BR-CO-17</span>
            {fixed && <span className="text-xs text-emerald-400">✓ 99.99 → 22.04</span>}
          </div>
          <div className="text-white/80">VAT amount is incorrect</div>
          <div className="mt-1 text-xs text-white/50">
            {demo.expected}: €22.04 (314.86 × 7%) · {demo.found}: {fixed ? '€22.04' : '€99.99'}
          </div>
        </div>

        {/* BR-DE-15 — the one that needs a person, fixed or not */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <span className="text-amber-300">BR-DE-15</span>
          <div className="text-white/80">Missing buyer reference (BT-10)</div>
          {fixed && <div className="mt-1 text-xs text-white/50">{demo.keptNote}</div>}
        </div>

        {fixed ? (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-emerald-400">✓ {demo.fixedBadge}</span>
            <Link
              href={localePath(copy.locale, 'playground')}
              className="text-xs text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white"
            >
              {demo.tryYours}
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFixed(true)}
            className="w-full rounded-lg bg-accent px-4 py-2.5 font-sans text-sm font-medium text-white transition hover:bg-accent-hi"
          >
            {demo.fixButton}
          </button>
        )}
      </div>
    </div>
  );
}

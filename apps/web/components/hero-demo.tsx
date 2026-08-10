'use client';

import Link from 'next/link';
import { useState } from 'react';
import { localePath, type Copy } from '@/lib/copy';

/**
 * The hero's product visual: a validation panel a visitor can actually click.
 * One press of "Fix automatically" shows the honest outcome — the arithmetic
 * error is repaired, the second violation is NOT, because it has no derivable
 * value. That asymmetry is the product's whole differentiator, so the demo
 * leads with it rather than pretending everything is fixable.
 *
 * Which two rules it shows comes from the copy dictionary, not from constants
 * here: the English page has to work for a reader in Leeds or Austin, so it
 * demonstrates the asymmetry with European core rules that apply in every
 * market, while the German page uses the BR-DE rule its readers actually hit.
 * The panel names the ruleset it ran for the same reason the result screen
 * does — nobody should have to guess what "valid" was measured against.
 *
 * The numbers are the same real BR-CO-17 case as the CLI samples further down
 * the page (22.04 = 314.86 × 7%), so a visitor who tries the playground sees
 * the same behaviour the hero promised.
 */
export function HeroDemo({ copy }: { copy: Copy }) {
  const [fixed, setFixed] = useState(false);
  const demo = copy.heroDemo;

  return (
    <div className="overflow-hidden rounded-xl border border-border-hi bg-surface shadow-xl shadow-accent/5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <span className="font-mono text-xs text-muted">invoice.xml</span>
        <span className="flex items-center gap-3 font-mono text-xs">
          <span className="text-success">✓ {demo.passedCount} {demo.passed}</span>
          <span className={fixed ? 'text-warning' : 'text-danger'}>
            ✗ {fixed ? 1 : 2} {demo.errors}
          </span>
        </span>
        <span className="w-full font-mono text-[11px] text-faint">{demo.ruleset}</span>
      </div>

      <div className="space-y-3 p-5 font-mono text-[13px] leading-relaxed">
        {/* The derivable, fixable one */}
        <div
          className={`rounded-lg border p-3 transition-colors duration-500 ${
            fixed ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className={fixed ? 'text-success' : 'text-danger'}>{demo.fixableRule}</span>
            {fixed && <span className="text-xs text-success">✓ 99.99 → 22.04</span>}
          </div>
          <div className="text-text">{demo.fixableTitle}</div>
          <div className="mt-1 text-xs text-faint">
            {demo.expected}: €22.04 (314.86 × 7%) · {demo.found}: {fixed ? '€22.04' : '€99.99'}
          </div>
        </div>

        {/* The one that needs a person, fixed or not */}
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <span className="text-warning">{demo.keptRule}</span>
          <div className="text-text">{demo.keptTitle}</div>
          {fixed && <div className="mt-1 text-xs text-faint">{demo.keptNote}</div>}
        </div>

        {fixed ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-success">✓ {demo.fixedBadge}</span>
            <Link
              href={localePath(copy.locale, 'playground')}
              className="text-xs text-accent-hi underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
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

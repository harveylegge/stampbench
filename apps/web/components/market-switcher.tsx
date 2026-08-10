'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag } from '@/components/flag';
import { MARKETS, PAGE_MARKETS, rulesetFor, type MarketId } from '@/lib/markets';

/**
 * The compact "Validate for: 🇬🇧 United Kingdom ▾" control.
 *
 * The market is not a filter on what the user is allowed to do — it selects
 * which ruleset runs, and every option stays one click away, because a
 * validator that quietly decided your jurisdiction for you would be exactly
 * the confusion this redesign exists to remove.
 */
export function MarketSwitcher({
  value,
  onChange,
  label = 'Validate for',
}: {
  value: MarketId;
  onChange: (id: MarketId) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const market = MARKETS[value];
  const ruleset = rulesetFor(value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-muted">{label}</span>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-border-hi"
        >
          <Flag code={market.flag} size={20} />
          {market.name}
          <span aria-hidden className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        <span className="font-mono text-xs text-faint">
          {ruleset.label} · {ruleset.ruleCount} rules
        </span>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Market"
          className="absolute left-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          {PAGE_MARKETS.map((id) => {
            const option = MARKETS[id];
            const optionRules = rulesetFor(id);
            const selected = id === value;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-2 ${
                  selected ? 'bg-accent-dim/40' : ''
                }`}
              >
                <span className="mt-0.5 text-muted">
                  <Flag code={option.flag} size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.name}</span>
                  <span className="block font-mono text-xs text-faint">
                    {optionRules.label} · {optionRules.ruleCount} rules
                  </span>
                </span>
                {selected && <span className="ml-auto text-accent-hi">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

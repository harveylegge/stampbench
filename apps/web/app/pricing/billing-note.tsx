'use client';

/**
 * The one line under each paid plan's button that says how payment actually
 * happens. The page is statically exported, so whether card checkout is live
 * is unknowable at build time — the worker is asked after mount, exactly like
 * the playground's AI button.
 *
 * Renders the manual-path wording first and swaps only if billing is on:
 * of the two possible stale states, promising email-and-arrange when cards
 * work is merely conservative, while promising card checkout when only the
 * manual path exists is a broken promise at the moment of purchase.
 */

import { useEffect, useState } from 'react';

export function BillingNote() {
  const [mode, setMode] = useState<'manual' | 'paypal' | 'cards'>('manual');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : {}))
      .then((s: { enabled?: boolean; paypal?: boolean }) => {
        if (cancelled) return;
        // Cards win when both exist: instant activation beats a manual check.
        if (s.enabled) setMode('cards');
        else if (s.paypal) setMode('paypal');
      })
      .catch(() => {
        /* worker unreachable — keep the conservative wording */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className="mt-2 text-center text-xs text-faint">
      {mode === 'cards'
        ? 'Pay by card after signup — activates instantly, cancel anytime.'
        : mode === 'paypal'
          ? 'Pay by PayPal after signup — we switch your plan on once it lands, usually the same day.'
          : 'No card on the site — we email you to arrange payment and activation.'}
    </p>
  );
}

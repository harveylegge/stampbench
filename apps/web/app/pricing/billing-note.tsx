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
  const [cardsLive, setCardsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((s: { enabled?: boolean }) => {
        if (!cancelled) setCardsLive(!!s.enabled);
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
      {cardsLive
        ? 'Pay by card after signup — activates instantly, cancel anytime.'
        : 'No card on the site — we email you to arrange payment and activation.'}
    </p>
  );
}

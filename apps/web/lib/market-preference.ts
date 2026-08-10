'use client';

import { isMarketId, type MarketId } from './markets';

/**
 * The visitor's chosen market, remembered in localStorage.
 *
 * Deliberately not an account setting and not a cookie: choosing where you do
 * business is not a reason to make someone sign up, and it is not data anyone
 * else needs to see. It never leaves the browser, so it also does not touch
 * the "no analytics, no tracking" promise on /privacy.
 *
 * Every access is wrapped: Safari in private mode throws on localStorage, and
 * a header that cannot render because storage is disabled would be a genuinely
 * silly way to break the site.
 */
const KEY = 'sb_market';

/** Fired on the window when the preference changes, so open panels can follow. */
export const MARKET_EVENT = 'sb:market';

export function readMarket(): MarketId | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(KEY);
    return isMarketId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeMarket(id: MarketId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Storage unavailable (private mode, blocked cookies). The choice still
    // applies to this page — it just will not survive a reload.
  }
  window.dispatchEvent(new CustomEvent(MARKET_EVENT, { detail: id }));
}

export function clearMarket(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* see writeMarket */
  }
  window.dispatchEvent(new CustomEvent(MARKET_EVENT, { detail: null }));
}

/** Subscribe to changes, including from another tab. Returns an unsubscribe. */
export function onMarketChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) handler();
  };
  window.addEventListener(MARKET_EVENT, handler);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(MARKET_EVENT, handler);
    window.removeEventListener('storage', onStorage);
  };
}

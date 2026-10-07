/**
 * Pins the page-view counter's one decision: countablePath (workers/api/src/
 * analytics.ts): which is also the privacy boundary: it must count only real
 * HTML page loads and must collapse anything hostile or high-cardinality, so
 * the aggregate table can never hold anything resembling personal data or grow
 * unbounded from mistyped URLs.
 */
import { describe, expect, it } from 'vitest';

import { analyticsDay, countablePath } from '../../../workers/api/src/analytics';

const HTML = 'text/html,application/xhtml+xml';
const path = (url: string, method = 'GET', accept: string | null = HTML, ua: string | null = 'Mozilla/5.0') =>
  countablePath(url, method, accept, ua);

describe('countablePath', () => {
  it('counts a normal HTML page view, normalised', () => {
    expect(path('https://stampbench.com/pricing')).toBe('/pricing');
    expect(path('https://stampbench.com/')).toBe('/');
    expect(path('https://stampbench.com/DE/')).toBe('/de');
    expect(path('https://stampbench.com/docs?ref=hn#library')).toBe('/docs');
    expect(path('https://stampbench.com/markets/germany')).toBe('/markets/germany');
  });

  it('skips non-GET, non-HTML, and the API', () => {
    expect(path('https://stampbench.com/pricing', 'POST')).toBeNull();
    expect(path('https://stampbench.com/pricing', 'GET', 'application/json')).toBeNull();
    expect(path('https://stampbench.com/pricing', 'GET', null)).toBeNull();
    expect(path('https://stampbench.com/api/health')).toBeNull();
    expect(path('https://stampbench.com/api')).toBeNull();
  });

  it('skips asset files by extension', () => {
    expect(path('https://stampbench.com/icon.png')).toBeNull();
    expect(path('https://stampbench.com/_next/static/chunk.js')).toBeNull();
    expect(path('https://stampbench.com/favicon.ico')).toBeNull();
    expect(path('https://stampbench.com/brand/logo.svg')).toBeNull();
  });

  it('skips bots so the numbers are people', () => {
    expect(path('https://stampbench.com/', 'GET', HTML, 'Googlebot/2.1')).toBeNull();
    expect(path('https://stampbench.com/', 'GET', HTML, 'facebookexternalhit/1.1')).toBeNull();
    expect(path('https://stampbench.com/', 'GET', HTML, 'curl/8.4')).toBeNull();
    // A missing UA is not assumed to be a bot.
    expect(path('https://stampbench.com/', 'GET', HTML, null)).toBe('/');
  });

  it('collapses hostile or high-cardinality paths to /other', () => {
    expect(path('https://stampbench.com/' + 'a'.repeat(100))).toBe('/other');
    expect(path('https://stampbench.com/search?q=<script>')).toBe('/search'); // query stripped, path safe
    expect(path('https://stampbench.com/pa th')).toBe('/other'); // space is not in the safe charset
    // Path traversal is neutralised by the URL parser itself (/../secret -> /secret).
    expect(path('https://stampbench.com/%2e%2e/secret')).toBe('/secret');
    expect(path('https://stampbench.com/pATh/With/CAPS')).toBe('/path/with/caps');
  });

  it('rejects a malformed URL rather than throwing', () => {
    expect(path('not a url')).toBeNull();
  });
});

describe('analyticsDay', () => {
  it('is the UTC calendar day', () => {
    expect(analyticsDay(new Date('2026-08-25T23:59:59Z'))).toBe('2026-08-25');
    expect(analyticsDay(new Date('2026-08-26T00:00:01Z'))).toBe('2026-08-26');
  });
});

/**
 * Privacy-preserving page-view counting.
 *
 * The site's privacy policy promises "no analytics scripts at all — nothing
 * executing in your browser", so this runs entirely in the worker at the
 * edge and stores ONLY aggregate counts: (day, path) → count. No IP, no
 * cookie, no user id, no per-visit row — nothing that is personal data, and
 * nothing that could reconstruct one person's browsing. That is the whole
 * design constraint, not an implementation detail: keep it that way.
 *
 * The pure decision (what counts as a page view) lives here so the web test
 * suite can pin it; the D1 write and the admin read stay in index.ts.
 */

/** Obvious crawlers, so the numbers reflect people, not bots. */
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|preview|monitor|curl|wget|python-requests|headless/i;

/**
 * The path to count for a request, or null to skip it.
 *
 * Counts only GET navigations to HTML (Accept includes text/html), never the
 * API, never asset files (anything with an extension), never bots. The path
 * is normalised — lowercased, de-slashed, query stripped, length-capped — and
 * anything outside a conservative charset collapses to '/other' so a hostile
 * or mistyped URL cannot blow up the table's cardinality.
 */
export function countablePath(
  rawUrl: string,
  method: string,
  accept: string | null,
  userAgent: string | null,
): string | null {
  if (method !== 'GET') return null;
  if (!accept || !accept.includes('text/html')) return null;
  if (userAgent && BOT_UA.test(userAgent)) return null;

  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  if (pathname.startsWith('/api/') || pathname === '/api') return null;

  // An asset request (has a file extension in the last segment) is not a page.
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return null;

  let path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path.length > 64 || !/^\/[a-z0-9/_-]*$/.test(path)) path = '/other';
  return path;
}

/** UTC day key, YYYY-MM-DD — the bucket page views are grouped into. */
export function analyticsDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

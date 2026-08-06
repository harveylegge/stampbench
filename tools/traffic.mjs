/**
 * Who is actually visiting stampbench.com?
 *
 *   node tools/traffic.mjs [days]        # default 7
 *
 * Reads Cloudflare's zone analytics through the GraphQL API. No beacon script,
 * no cookies, nothing added to the site — Cloudflare already counts every
 * request at the edge, this just asks for the totals.
 *
 * Auth: reuses the wrangler OAuth login (`npx wrangler login`). Set
 * CLOUDFLARE_API_TOKEN to override with a scoped API token instead.
 *
 * Read the "human" column with suspicion, not faith. Every public domain is
 * scanned continuously by crawlers, security scanners and cloud probes, and
 * those show up here as visitors. The bot/human split below is a heuristic
 * over browser families, not ground truth.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ZONE_NAME = 'stampbench.com';
const API = 'https://api.cloudflare.com/client/v4';

/** Browser families Cloudflare reports that are never a person reading the site. */
const BOT_FAMILIES = new Set([
  'GoogleBot', 'BingBot', 'YandexBot', 'Baiduspider', 'DuckDuckBot',
  'AhrefsBot', 'SemrushBot', 'DotBot', 'MJ12bot', 'PetalBot',
  'Applebot', 'FacebookBot', 'Bytespider', 'Unknown',
]);

function wranglerToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const candidates = [
    process.env.APPDATA && join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml'),
    join(homedir(), '.config', '.wrangler', 'config', 'default.toml'),
    join(homedir(), '.wrangler', 'config', 'default.toml'),
  ].filter(Boolean);
  for (const path of candidates) {
    try {
      const token = readFileSync(path, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
      if (token) return token;
    } catch {
      // try the next location
    }
  }
  throw new Error('No Cloudflare credentials. Run `npx wrangler login` or set CLOUDFLARE_API_TOKEN.');
}

async function cf(path, token) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!body.success) throw new Error(`${path} failed: ${JSON.stringify(body.errors)}`);
  return body.result;
}

async function graphql(query, token) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
  return body.data;
}

const days = Number(process.argv[2] ?? 7);
const token = wranglerToken();

const zones = await cf(`/zones?name=${ZONE_NAME}`, token);
if (!zones.length) throw new Error(`Zone ${ZONE_NAME} not found on this account.`);
const zoneTag = zones[0].id;

const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const data = await graphql(
  `query { viewer { zones(filter: {zoneTag: "${zoneTag}"}) {
     httpRequests1dGroups(limit: 60, filter: {date_geq: "${since}"}, orderBy: [date_ASC]) {
       dimensions { date }
       sum {
         requests
         pageViews
         countryMap { clientCountryName requests }
         browserMap { uaBrowserFamily pageViews }
       }
       uniq { uniques }
     } } } }`,
  token,
);

const rows = data.viewer.zones[0]?.httpRequests1dGroups ?? [];
if (!rows.length) {
  console.log(`No traffic recorded for ${ZONE_NAME} since ${since}.`);
  process.exit(0);
}

console.log(`\n${ZONE_NAME} — last ${days} days\n`);
console.log('date         views   uniq    req   likely-human   top countries');
console.log('─'.repeat(78));

let totalViews = 0;
let totalHuman = 0;

for (const row of rows) {
  const { date } = row.dimensions;
  const views = row.sum.pageViews;
  const human = row.sum.browserMap
    .filter((b) => !BOT_FAMILIES.has(b.uaBrowserFamily))
    .reduce((n, b) => n + b.pageViews, 0);
  const countries = row.sum.countryMap
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 4)
    .map((c) => `${c.clientCountryName} ${c.requests}`)
    .join(', ');

  totalViews += views;
  totalHuman += human;

  console.log(
    `${date}  ${String(views).padStart(6)} ${String(row.uniq.uniques).padStart(6)} ` +
      `${String(row.sum.requests).padStart(6)}   ${String(human).padStart(12)}   ${countries}`,
  );
}

console.log('─'.repeat(78));
console.log(`total        ${String(totalViews).padStart(6)}                     ${String(totalHuman).padStart(12)}`);

// Search-engine crawlers are the signal that actually matters right now: they
// mean indexing is under way, which has to happen before anyone can find us.
const crawlers = new Map();
for (const row of rows) {
  for (const b of row.sum.browserMap) {
    if (b.uaBrowserFamily.toLowerCase().includes('bot') || b.uaBrowserFamily === 'Applebot') {
      crawlers.set(b.uaBrowserFamily, (crawlers.get(b.uaBrowserFamily) ?? 0) + b.pageViews);
    }
  }
}
console.log(
  '\nsearch crawlers:',
  crawlers.size ? [...crawlers].map(([k, v]) => `${k} ${v}`).join(', ') : 'none seen yet',
);
console.log(
  '\nNote: "likely-human" still includes you, and any scanner presenting a normal\n' +
    'browser string. Treat it as an upper bound, not an audience.\n',
);

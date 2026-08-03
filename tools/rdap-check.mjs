/**
 * Authoritative .com registration check via Verisign RDAP (the .com registry operator).
 *   HTTP 404 → domain is NOT registered (available to register)
 *   HTTP 200 → domain IS registered (taken)
 * Anything else → inconclusive, reported as such rather than guessed.
 *
 * Usage: node rdap-check.mjs name1 name2 ...      (names, not domains)
 *        node rdap-check.mjs --file names.txt
 */
import { readFileSync } from 'node:fs';

const RDAP = 'https://rdap.verisign.com/com/v1/domain/';
const CONCURRENCY = 6;
const args = process.argv.slice(2);

let names = [];
if (args[0] === '--file') {
  names = readFileSync(args[1], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
} else {
  names = args;
}
names = [...new Set(names.map((n) => n.toLowerCase().replace(/[^a-z0-9-]/g, '')))].filter(Boolean);

async function checkOne(name, attempt = 0) {
  const domain = `${name}.com`;
  try {
    const res = await fetch(RDAP + domain.toUpperCase(), {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return { name, domain, status: 'AVAILABLE' };
    if (res.status === 200) {
      let created = '';
      try {
        const body = await res.json();
        const ev = (body.events ?? []).find((e) => e.eventAction === 'registration');
        created = ev?.eventDate?.slice(0, 10) ?? '';
      } catch { /* body not needed */ }
      return { name, domain, status: 'TAKEN', created };
    }
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return checkOne(name, attempt + 1);
    }
    return { name, domain, status: `HTTP_${res.status}` };
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      return checkOne(name, attempt + 1);
    }
    return { name, domain, status: 'ERROR', note: String(e.message ?? e).slice(0, 60) };
  }
}

const results = [];
let idx = 0;
async function worker() {
  while (idx < names.length) {
    const i = idx++;
    const r = await checkOne(names[i]);
    results.push(r);
    await new Promise((res) => setTimeout(res, 120)); // be polite to the registry
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

results.sort((a, b) => a.name.localeCompare(b.name));
const avail = results.filter((r) => r.status === 'AVAILABLE');
const taken = results.filter((r) => r.status === 'TAKEN');
const other = results.filter((r) => r.status !== 'AVAILABLE' && r.status !== 'TAKEN');

for (const r of results) console.log(`${r.status.padEnd(10)} ${r.domain}${r.created ? '  (reg ' + r.created + ')' : ''}${r.note ? '  ' + r.note : ''}`);
console.log(`\n--- SUMMARY: ${results.length} checked | ${avail.length} AVAILABLE | ${taken.length} taken | ${other.length} inconclusive ---`);
console.log('AVAILABLE_LIST: ' + avail.map((r) => r.name).join(' '));
if (other.length) console.log('INCONCLUSIVE_LIST: ' + other.map((r) => r.name).join(' '));

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateXml } from '../src/index.js';
import { locateViolations } from '../src/locate/index.js';

/**
 * How good are the line numbers when invoices are actually broken?
 *
 * The official corpus is all-valid, so it cannot answer that — 86 documents
 * raise only 9 violations between them. This sweep deletes one required field
 * at a time from every corpus document and measures where the resulting
 * violations get anchored. Deletion is the dominant real failure mode: almost
 * every rule in EN 16931 fires because something mandatory is missing.
 *
 * The guarantee being protected is that nothing silently degrades to "line 1".
 * A regression here means some rule started emitting violations that carry
 * neither a bound path nor a mappable business term.
 *
 * Skips when the corpus has not been downloaded (tools/parity/.gitignore).
 */
const CORPUS = fileURLToPath(new URL('../../../tools/parity/vendor/testsuite/instances', import.meta.url));

function xmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (p: string): void => {
    for (const entry of readdirSync(p).sort()) {
      const full = join(p, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.toLowerCase().endsWith('.xml')) found.push(full);
    }
  };
  walk(dir);
  return found;
}

/** A line holding exactly one complete leaf element — the deletable unit. */
const LEAF = /^\s*<([\w:.-]+)(\s[^>]*)?>([^<]*)<\/\1>\s*$/;

/** Every third candidate line; the full sweep is ~9,900 mutants and 24s. */
const SAMPLE_EVERY = 3;

describe.skipIf(xmlFiles(CORPUS).length === 0)('anchor quality under field deletion', () => {
  it('anchors essentially every violation to a real element, never to line 1', () => {
    const precision = { exact: 0, ancestor: 0, document: 0 };
    const unanchored = new Map<string, number>();
    let violations = 0;
    let candidate = 0;

    for (const file of xmlFiles(CORPUS)) {
      const original = readFileSync(file, 'utf8');
      const base = validateXml(original, { profile: 'xrechnung' });
      if (base.syntax === undefined) continue;
      const baseline = new Set(base.violations.map((v) => `${v.ruleId}|${v.message}`));
      const lines = original.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (!LEAF.test(lines[i]!)) continue;
        if (candidate++ % SAMPLE_EVERY !== 0) continue;
        const mutated = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
        const result = validateXml(mutated, { profile: 'xrechnung' });
        if (result.syntax === undefined) continue;
        const fresh = result.violations.filter((v) => !baseline.has(`${v.ruleId}|${v.message}`));
        if (fresh.length === 0) continue;

        for (const v of locateViolations(mutated, fresh, result.syntax)) {
          violations++;
          precision[v.location.precision]++;
          if (v.location.precision === 'document') {
            unanchored.set(v.ruleId, (unanchored.get(v.ruleId) ?? 0) + 1);
          }
          // Whatever the precision, the line must be real.
          expect(v.location.line).toBeGreaterThan(0);
        }
      }
    }

    // Guard against a vacuous pass if mutation stops producing violations.
    expect(violations).toBeGreaterThan(500);

    // No rule may fall through to the document root. If this fails, the named
    // rules emit no bound path and no mappable BT-/BG- term — give them one
    // rather than lowering this bar.
    expect(Object.fromEntries(unanchored)).toEqual({});

    const anchored = (precision.exact + precision.ancestor) / violations;
    expect(anchored).toBeGreaterThanOrEqual(0.95);
  }, 120_000);
});

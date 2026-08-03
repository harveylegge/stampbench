import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bindingFor } from '../src/locate/bindings.js';

/**
 * The contract that keeps CI annotations honest as the rule set grows.
 *
 * A rule that reports `path: 'seller.newField'` with no binding degrades
 * silently — the annotation quietly slides up to an ancestor and nobody
 * notices. So: scan the rule sources for every path a violation can carry, and
 * require each one to be bound for *both* syntaxes. Adding a rule with an
 * unbound path fails here rather than in a user's pull request.
 */
const RULE_FILES = ['en16931.ts', 'vat-categories.ts', 'xrechnung.ts'];

/** `path:` values, both template literals and plain strings. */
const PATH_RE = /path:\s*(`[^`]*`|'[^']*')/g;
/** Local `const x = \`…\`` declarations, used to resolve interpolated prefixes. */
const CONST_RE = /const\s+(\w+)\s*=\s*`([^`]*)`/g;

interface FoundPath {
  file: string;
  raw: string;
  key: string;
}

function collectPaths(): FoundPath[] {
  const found: FoundPath[] = [];

  for (const file of RULE_FILES) {
    const source = readFileSync(
      fileURLToPath(new URL(`../src/validate/rules/${file}`, import.meta.url)),
      'utf8',
    );

    // e.g. `const p = \`vatBreakdown[${idx}]\`` so that `${p}.rate` resolves.
    const locals = new Map<string, string>();
    for (const match of source.matchAll(CONST_RE)) {
      locals.set(match[1]!, match[2]!);
    }

    for (const match of source.matchAll(PATH_RE)) {
      const raw = match[1]!.slice(1, -1);
      // Substitute local prefixes, then collapse every index to `[]`.
      const substituted = raw.replace(/\$\{(\w+)\}/g, (whole, name: string) => locals.get(name) ?? whole);
      const key = substituted.replace(/\[\$\{[^}]*\}\]/g, '[]').replace(/\[\d+\]/g, '[]');
      found.push({ file, raw, key });
    }
  }

  return found;
}

describe('binding contract', () => {
  const paths = collectPaths();

  it('finds the paths the rules emit', () => {
    // Guards the scanner itself: if a refactor changes how paths are written
    // and this drops to zero, the whole contract would pass vacuously.
    expect(paths.length).toBeGreaterThanOrEqual(20);
  });

  it('resolves every interpolated path template statically', () => {
    const unresolved = paths.filter((p) => p.key.includes('${')).map((p) => `${p.file}: ${p.raw}`);
    expect(unresolved).toEqual([]);
  });

  it('binds every emitted path for UBL', () => {
    const missing = [...new Set(paths.filter((p) => bindingFor('ubl', p.key) === undefined).map((p) => p.key))];
    expect(missing).toEqual([]);
  });

  it('binds every emitted path for CII', () => {
    const missing = [...new Set(paths.filter((p) => bindingFor('cii', p.key) === undefined).map((p) => p.key))];
    expect(missing).toEqual([]);
  });
});

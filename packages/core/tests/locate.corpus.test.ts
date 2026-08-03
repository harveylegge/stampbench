import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateXml } from '../src/index.js';
import { locateViolations } from '../src/locate/index.js';

/**
 * End-to-end proof that the bindings point at the *right* element.
 *
 * For every violation the validator raises on the official XRechnung corpus
 * that carries the offending value, the text at the resolved location must be
 * that same value. A binding that points one element away — the wrong
 * TaxTotal, the wrong PartyTaxScheme, an off-by-one line index — fails here
 * even though it would look perfectly plausible in isolation.
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

const FILES = xmlFiles(CORPUS);

/** Numeric when both sides parse as numbers, textual otherwise. */
function sameValue(expected: string | number, actual: string): boolean {
  const a = Number(expected);
  const b = Number(actual);
  if (Number.isFinite(a) && Number.isFinite(b) && actual.trim() !== '') return a === b;
  return String(expected).trim() === actual.trim();
}

describe.skipIf(FILES.length === 0)('locateViolations against the official XRechnung corpus', () => {
  it('resolves each violation to an element holding the value the rule reported', () => {
    const mismatches: string[] = [];
    let checked = 0;

    for (const file of FILES) {
      const xml = readFileSync(file, 'utf8');
      const result = validateXml(xml, { profile: 'xrechnung' });
      if (result.syntax === undefined) continue;

      for (const v of locateViolations(xml, result.violations, result.syntax)) {
        if (v.value === undefined) continue;
        if (v.location.precision !== 'exact') continue;
        if (v.location.value === undefined) continue;
        checked++;
        if (!sameValue(v.value, v.location.value)) {
          mismatches.push(
            `${file.split(/[\\/]/).pop()}:${v.location.line} ${v.ruleId} (${v.path ?? v.terms?.join('/')}) ` +
              `→ ${v.location.xpath} holds "${v.location.value}" but the rule reported "${v.value}"`,
          );
        }
      }
    }

    expect(mismatches.slice(0, 15)).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });

  it('never reports a line beyond the end of the document', () => {
    const bad: string[] = [];
    for (const file of FILES) {
      const xml = readFileSync(file, 'utf8');
      const lineCount = xml.split(/\r\n|\r|\n/).length;
      const result = validateXml(xml, { profile: 'xrechnung' });
      if (result.syntax === undefined) continue;
      for (const v of locateViolations(xml, result.violations, result.syntax)) {
        if (v.location.line < 1 || v.location.line > lineCount) {
          bad.push(`${file}:${v.location.line} out of 1..${lineCount} (${v.ruleId})`);
        }
      }
    }
    expect(bad.slice(0, 15)).toEqual([]);
  });

  it('gives every violation a location', () => {
    for (const file of FILES.slice(0, 10)) {
      const xml = readFileSync(file, 'utf8');
      const result = validateXml(xml, { profile: 'xrechnung' });
      if (result.syntax === undefined) continue;
      const located = locateViolations(xml, result.violations, result.syntax);
      expect(located).toHaveLength(result.violations.length);
      for (const v of located) expect(v.location).toBeDefined();
    }
  });
});

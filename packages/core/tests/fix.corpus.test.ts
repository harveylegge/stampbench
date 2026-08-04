import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateXml } from '../src/index.js';
import { fixXml } from '../src/fix/index.js';

/**
 * The guarantee repair has to earn: corrupt a figure the rules can recompute,
 * and **every line except that one comes back byte-for-byte identical**, with
 * the corrected line numerically equal to the original.
 *
 * That exactness is the whole point. It proves the repair touched the wrong
 * value and nothing else — not the formatting, not the comments, not the
 * namespace prefixes, not the line endings, and above all none of the content
 * the semantic model does not represent, which regenerating the document would
 * have silently discarded.
 *
 * The one thing not preserved is decimal presentation: a corrected amount is
 * written to two decimals, so a document stating `336.9` comes back as
 * `336.90`. The value is unchanged and both are valid EN 16931; there is no way
 * to recover the original's formatting from a document that no longer contains
 * it.
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

/**
 * Elements whose value the rules derive from other figures, so a corruption is
 * recoverable exactly. Deliberately excludes inputs such as line amounts and
 * rates — corrupting those changes what the correct answer *is*, so the
 * original is no longer recoverable and byte equality would be the wrong test.
 */
const DERIVED = [
  'PayableAmount',
  'TaxInclusiveAmount',
  'TaxExclusiveAmount',
  'DuePayableAmount',
  'GrandTotalAmount',
  'TaxBasisTotalAmount',
];

/** Corrupt the first decimal number inside the named element, if present. */
function corrupt(xml: string, element: string): { xml: string; line: number } | undefined {
  const terminator = xml.includes('\r\n') ? '\r\n' : '\n';
  const lines = xml.split(/\r\n|\r|\n/);
  const pattern = new RegExp(`<[\\w:]*${element}[^>]*>(-?\\d+\\.\\d+)</`);
  for (let i = 0; i < lines.length; i++) {
    const match = pattern.exec(lines[i]!);
    if (match === null) continue;
    const original = match[1]!;
    // A change large enough to exceed every tolerance in the rule set.
    const broken = (Number(original) + 11.11).toFixed(2);
    lines[i] = lines[i]!.replace(`>${original}<`, `>${broken}<`);
    return { xml: lines.join(terminator), line: i + 1 };
  }
  return undefined;
}

describe.skipIf(FILES.length === 0)('fixXml against the official XRechnung corpus', () => {
  it('restores a corrupted derived figure and changes nothing else', () => {
    const failures: string[] = [];
    let repaired = 0;
    let documents = 0;
    let byteIdentical = 0;

    for (const file of FILES) {
      const original = readFileSync(file, 'utf8');
      // Only documents that start clean: if a file already has violations, a
      // repair may legitimately fix those too and the comparison would not hold.
      if (validateXml(original, { profile: 'xrechnung' }).errorCount !== 0) continue;
      documents++;

      for (const element of DERIVED) {
        const broken = corrupt(original, element);
        if (broken === undefined) continue;
        if (validateXml(broken.xml, { profile: 'xrechnung' }).errorCount === 0) continue;

        // confirmAmountDue simulates the user confirming the amount due is the
        // wrong figure — this sweep corrupts it deliberately, so it is.
        const result = fixXml(broken.xml, { profile: 'xrechnung', confirmAmountDue: true });
        repaired++;
        const name = `${file.split(/[\\/]/).pop()} [${element}]`;

        if (!result.valid) {
          failures.push(`${name}: still ${result.errorsAfter} errors after repair`);
          continue;
        }
        if (result.xml === original) {
          byteIdentical++;
          continue;
        }

        // Otherwise: only the corrupted line may differ, and only in decimal
        // presentation of the same number.
        const before = original.split(/\r\n|\r|\n/);
        const after = result.xml.split(/\r\n|\r|\n/);
        if (after.length !== before.length) {
          failures.push(`${name}: line count changed ${before.length} → ${after.length}`);
          continue;
        }
        for (let i = 0; i < before.length; i++) {
          if (before[i] === after[i]) continue;
          if (i + 1 !== broken.line) {
            failures.push(`${name}: line ${i + 1} changed but only line ${broken.line} was corrupted`);
            break;
          }
          const numbers = (text: string) => (text.match(/-?\d+\.\d+/g) ?? []).map(Number);
          if (JSON.stringify(numbers(before[i]!)) !== JSON.stringify(numbers(after[i]!))) {
            failures.push(`${name}: line ${i + 1} value differs — "${after[i]!.trim()}" vs "${before[i]!.trim()}"`);
          }
        }
      }
    }

    expect(failures.slice(0, 15)).toEqual([]);
    expect(documents).toBeGreaterThan(50);
    expect(repaired).toBeGreaterThan(50);
    // Most repairs land on an amount already written to two decimals, so the
    // file really does come back byte-identical.
    expect(byteIdentical).toBeGreaterThan(repaired / 2);
  }, 300_000);

  it('never makes a document worse', () => {
    const worse: string[] = [];
    for (const file of FILES) {
      const xml = readFileSync(file, 'utf8');
      const result = fixXml(xml, { profile: 'xrechnung' });
      if (result.errorsAfter > result.errorsBefore) {
        worse.push(`${file}: ${result.errorsBefore} → ${result.errorsAfter}`);
      }
      // An untouched document must come back identical, not merely equivalent.
      if (result.applied.length === 0 && result.xml !== xml) {
        worse.push(`${file}: rewritten despite applying no edits`);
      }
    }
    expect(worse.slice(0, 10)).toEqual([]);
  }, 300_000);

  it('refuses to invent business data', () => {
    // Deleting a mandatory identifier leaves nothing to compute. Repair must
    // decline, and say why, rather than fabricate a plausible value.
    const file = FILES.find((f) => f.endsWith('_ubl.xml'))!;
    const xml = readFileSync(file, 'utf8');
    const stripped = xml.replace(/<cbc:BuyerReference>[^<]*<\/cbc:BuyerReference>\s*/, '');
    expect(stripped).not.toBe(xml);

    const result = fixXml(stripped, { profile: 'xrechnung' });
    expect(result.applied.filter((e) => e.ruleId.includes('BR-DE-15'))).toEqual([]);
    const declined = result.unfixable.find((u) => u.ruleId === 'BR-DE-15');
    expect(declined).toBeDefined();
    expect(declined!.reason).toMatch(/absent|human/i);
  });
});

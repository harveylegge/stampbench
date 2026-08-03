import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexXml, type XmlNode } from '../src/locate/xml-index.js';

/**
 * Empirical check of the position scanner against the official XRechnung
 * 3.0.2 test-suite documents — real files with namespaces, comments, mixed
 * line endings and long multi-line tags.
 *
 * The corpus is downloaded, not committed (tools/parity/.gitignore), so this
 * suite skips when it is absent. It runs locally after `node
 * tools/parity/download.mjs`, and in the parity workflow which downloads it.
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

/** Every element, depth-first. */
function flatten(node: XmlNode, into: XmlNode[] = []): XmlNode[] {
  into.push(node);
  for (const child of node.children) flatten(child, into);
  return into;
}

describe.skipIf(FILES.length === 0)('indexXml against the official XRechnung corpus', () => {
  it('found the corpus', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('reports a line that actually contains the element, for every element in every document', () => {
    const failures: string[] = [];
    let elements = 0;

    for (const file of FILES) {
      const xml = readFileSync(file, 'utf8');
      const index = indexXml(xml);
      if (index.root === undefined) {
        failures.push(`${file}: no root element found`);
        continue;
      }
      // Split on the same three line terminators the scanner counts.
      const lines = xml.replace(/^﻿/, '').split(/\r\n|\r|\n/);

      for (const node of flatten(index.root)) {
        elements++;
        const line = lines[node.line - 1];
        if (line === undefined) {
          failures.push(`${file}:${node.line} — line out of range for <${node.qualifiedName}>`);
          continue;
        }
        if (!line.includes(`<${node.qualifiedName}`)) {
          failures.push(
            `${file}:${node.line} — expected <${node.qualifiedName} on this line, found: ${line.trim().slice(0, 80)}`,
          );
        }
        // The column must point at the '<' of that tag.
        if (line.slice(node.column - 1, node.column - 1 + node.qualifiedName.length + 1) !== `<${node.qualifiedName}`) {
          failures.push(
            `${file}:${node.line}:${node.column} — column does not point at <${node.qualifiedName}>`,
          );
        }
      }
    }

    expect(failures.slice(0, 20)).toEqual([]);
    expect(elements).toBeGreaterThan(1000);
  });

  it('reports value positions that point at the value text', () => {
    const failures: string[] = [];

    for (const file of FILES) {
      const xml = readFileSync(file, 'utf8');
      const index = indexXml(xml);
      if (index.root === undefined) continue;
      const lines = xml.replace(/^﻿/, '').split(/\r\n|\r|\n/);

      for (const node of flatten(index.root)) {
        if (node.valueLine === undefined || node.valueColumn === undefined) continue;
        const line = lines[node.valueLine - 1];
        if (line === undefined) {
          failures.push(`${file}:${node.valueLine} — value line out of range`);
          continue;
        }
        const ch = line[node.valueColumn - 1];
        // The recorded position must be a real, non-whitespace character.
        if (ch === undefined || /\s/.test(ch)) {
          failures.push(
            `${file}:${node.valueLine}:${node.valueColumn} — value position is not on a value character (<${node.qualifiedName}>)`,
          );
        }
      }
    }

    expect(failures.slice(0, 20)).toEqual([]);
  });

  it('reports attribute positions that point at the attribute name and its value', () => {
    const failures: string[] = [];
    let attributes = 0;

    for (const file of FILES) {
      const xml = readFileSync(file, 'utf8');
      const index = indexXml(xml);
      if (index.root === undefined) continue;
      const lines = xml.replace(/^﻿/, '').split(/\r\n|\r|\n/);

      for (const node of flatten(index.root)) {
        for (const [name, at] of node.attributes) {
          attributes++;
          const nameLine = lines[at.line - 1];
          if (nameLine === undefined || !nameLine.slice(at.column - 1).startsWith(at.qualifiedName)) {
            failures.push(`${file}:${at.line}:${at.column} — not the start of attribute "${name}"`);
          }
          const valueLine = lines[at.valueLine - 1];
          if (valueLine === undefined) {
            failures.push(`${file}:${at.valueLine} — attribute value line out of range`);
            continue;
          }
          // The character before the value must be the opening quote.
          const quote = valueLine[at.valueColumn - 2];
          if (quote !== '"' && quote !== "'") {
            failures.push(
              `${file}:${at.valueLine}:${at.valueColumn} — attribute "${name}" value not preceded by a quote`,
            );
          }
        }
      }
    }

    expect(failures.slice(0, 20)).toEqual([]);
    expect(attributes).toBeGreaterThan(100);
  });

  it('closes every element on a line at or after its opening tag', () => {
    const failures: string[] = [];
    for (const file of FILES) {
      const index = indexXml(readFileSync(file, 'utf8'));
      if (index.root === undefined) continue;
      for (const node of flatten(index.root)) {
        if (node.endLine < node.line) {
          failures.push(`${file} — <${node.qualifiedName}> ends at ${node.endLine} before it starts at ${node.line}`);
        }
        if (node.endLine > index.lineCount) {
          failures.push(`${file} — <${node.qualifiedName}> ends past the end of the document`);
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });
});

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LocatedViolation } from '@invoicegate/core';
import { formatGithub, formatSarif, workspacePath, type FileReport } from '../src/report.js';

function violation(overrides: Partial<LocatedViolation> = {}): LocatedViolation {
  return {
    ruleId: 'BR-DE-15',
    severity: 'error',
    message: 'Missing buyer reference.',
    terms: ['BT-10'],
    location: {
      line: 12,
      column: 3,
      endLine: 12,
      xpath: '/Invoice/BuyerReference',
      precision: 'exact',
      via: 'path',
    },
    ...overrides,
  };
}

function report(overrides: Partial<FileReport> = {}): FileReport {
  return { file: 'invoices/a.xml', profile: 'xrechnung', violations: [violation()], ...overrides };
}

describe('workspacePath', () => {
  it('makes paths relative to the workspace with forward slashes', () => {
    const cwd = join('C:', 'work', 'repo');
    expect(workspacePath(join(cwd, 'invoices', 'a.xml'), cwd)).toBe('invoices/a.xml');
  });

  it('leaves a path outside the workspace alone rather than emitting ../..', () => {
    const cwd = join('C:', 'work', 'repo');
    const outside = join('C:', 'elsewhere', 'a.xml');
    expect(workspacePath(outside, cwd)).toBe(outside.replace(/\\/g, '/'));
  });
});

describe('formatGithub', () => {
  it('emits a workflow command with file, line, column and rule title', () => {
    const { lines, emitted, suppressed } = formatGithub([report()], { cwd: process.cwd() });
    expect(emitted).toBe(1);
    expect(suppressed).toBe(0);
    expect(lines[0]).toBe(
      '::error file=invoices/a.xml,line=12,endLine=12,col=3,title=BR-DE-15 — InvoiceGate::Missing buyer reference. (BT-10)',
    );
  });

  it('uses ::warning for warnings', () => {
    const { lines } = formatGithub([report({ violations: [violation({ severity: 'warning' })] })]);
    expect(lines[0]!.startsWith('::warning ')).toBe(true);
  });

  it('escapes %, CR and LF in the message but leaves colons and commas readable', () => {
    const v = violation({ message: 'has 100% and\na newline, plus: a colon' });
    const { lines } = formatGithub([report({ violations: [v] })]);
    const message = lines[0]!.split('::')[2]!;
    expect(message).toContain('100%25');
    expect(message).toContain('%0A');
    expect(message).toContain('plus: a colon');
    expect(message).not.toContain('\n');
  });

  it('escapes colons and commas inside property values', () => {
    const { lines } = formatGithub([report({ file: 'odd,name:1.xml' })], { cwd: process.cwd() });
    expect(lines[0]).toContain('file=odd%2Cname%3A1.xml');
  });

  it('explains an approximate location instead of presenting it as exact', () => {
    const v = violation({
      location: {
        line: 4,
        column: 3,
        endLine: 9,
        xpath: '/Invoice',
        precision: 'ancestor',
        via: 'term',
      },
    });
    const { lines } = formatGithub([report({ violations: [v] })]);
    expect(lines[0]).toContain('no element for this field');
    expect(lines[0]).toContain('/Invoice');
  });

  it('caps annotations at the limit and reports how many were suppressed', () => {
    const many = { violations: [violation(), violation(), violation()] };
    const { emitted, suppressed } = formatGithub([report(many)], { limit: 2 });
    expect(emitted).toBe(2);
    expect(suppressed).toBe(1);
  });
});

describe('formatSarif', () => {
  const parsed = () =>
    JSON.parse(formatSarif([report()], { cwd: process.cwd(), version: '9.9.9' })) as {
      $schema: string;
      version: string;
      runs: {
        tool: { driver: { name: string; version: string; rules: { id: string }[] } };
        results: {
          ruleId: string;
          ruleIndex: number;
          level: string;
          message: { text: string };
          locations: {
            physicalLocation: {
              artifactLocation: { uri: string };
              region: { startLine: number; startColumn: number; endLine: number };
            };
          }[];
          partialFingerprints: Record<string, string>;
        }[];
      }[];
    };

  it('produces a SARIF 2.1.0 document with tool metadata', () => {
    const sarif = parsed();
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-2.1.0');
    expect(sarif.runs[0]!.tool.driver.name).toBe('InvoiceGate');
    expect(sarif.runs[0]!.tool.driver.version).toBe('9.9.9');
  });

  it('carries rule metadata and points each result at its rule by index', () => {
    const sarif = parsed();
    const run = sarif.runs[0]!;
    const result = run.results[0]!;
    expect(run.tool.driver.rules.length).toBeGreaterThan(20);
    expect(result.ruleId).toBe('BR-DE-15');
    expect(run.tool.driver.rules[result.ruleIndex]!.id).toBe('BR-DE-15');
  });

  it('reports a region with a relative, forward-slashed uri', () => {
    const location = parsed().runs[0]!.results[0]!.locations[0]!.physicalLocation;
    expect(location.artifactLocation.uri).toBe('invoices/a.xml');
    expect(location.region).toEqual({ startLine: 12, startColumn: 3, endLine: 12 });
  });

  it('fingerprints a finding stably across line moves', () => {
    const a = JSON.parse(formatSarif([report()], { version: '1' })) as {
      runs: { results: { partialFingerprints: Record<string, string> }[] }[];
    };
    const moved = report({ violations: [violation({ location: { ...violation().location, line: 99 } })] });
    const b = JSON.parse(formatSarif([moved], { version: '1' })) as typeof a;
    expect(a.runs[0]!.results[0]!.partialFingerprints['invoicegate/v1']).toBe(
      b.runs[0]!.results[0]!.partialFingerprints['invoicegate/v1'],
    );
  });

  it('still emits a finding for a rule that is not in the rule table', () => {
    const odd = report({ violations: [violation({ ruleId: 'SYNTAX' })] });
    const sarif = JSON.parse(formatSarif([odd], { version: '1' })) as {
      runs: { tool: { driver: { rules: { id: string }[] } }; results: { ruleIndex: number }[] }[];
    };
    const run = sarif.runs[0]!;
    expect(run.tool.driver.rules[run.results[0]!.ruleIndex]!.id).toBe('SYNTAX');
  });
});

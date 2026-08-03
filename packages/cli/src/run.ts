/**
 * invoicegate CLI — validate and generate XRechnung / EN 16931 e-invoices.
 *
 * All logic lives here (not in cli.ts) so tests can call run() directly
 * without spawning a child process.
 *
 * Exit codes:
 *   0  valid / success
 *   1  validation errors found
 *   2  usage or IO error
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  generateXRechnungUbl,
  validateInvoice,
  validateXml,
  withComputedTotals,
  withXRechnungDefaults,
} from '@invoicegate/core';
import type { Invoice, Profile, ValidationResult, Violation } from '@invoicegate/core';

/** Injectable output streams; each call receives one full line (no trailing \n). */
export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
}

interface Colors {
  red: (s: string) => string;
  yellow: (s: string) => string;
  green: (s: string) => string;
  bold: (s: string) => string;
  dim: (s: string) => string;
}

const USAGE = `invoicegate — validate and generate XRechnung / EN 16931 e-invoices

Usage:
  invoicegate validate <file.xml> [--profile xrechnung|en16931] [--json] [--quiet]
  invoicegate generate <invoice.json> [-o out.xml] [--no-validate]
  invoicegate --version
  invoicegate --help

Commands:
  validate   Check a UBL or CII (ZUGFeRD / Factur-X) invoice against the
             EN 16931 business rules, plus the German BR-DE rules when the
             profile is xrechnung (the default).
  generate   Build XRechnung 3.0 UBL XML from a JSON semantic model
             (either the bare invoice object or { "invoice": { ... } }).

Exit codes:
  0  valid / success
  1  validation errors found
  2  usage or IO error`;

const ESC = String.fromCharCode(27); // the ANSI escape character, kept out of the source as a literal byte

function makeColors(enabled: boolean): Colors {
  const wrap =
    (code: number) =>
    (s: string): string =>
      enabled ? `${ESC}[${code}m${s}${ESC}[0m` : s;
  return { red: wrap(31), yellow: wrap(33), green: wrap(32), bold: wrap(1), dim: wrap(2) };
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readOwnVersion(): string {
  // Works from both src/ (vitest) and dist/ (published bin): ../package.json
  // is this package's own manifest either way.
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? '0.0.0';
}

function formatViolation(v: Violation, c: Colors): string {
  const badge = v.severity === 'error' ? c.red('ERROR') : c.yellow('WARN ');
  const where = v.path ? c.dim(` (${v.path})`) : '';
  return `  ${badge}  ${c.bold(v.ruleId)}  ${v.message}${where}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function summaryLine(r: ValidationResult, c: Colors): string {
  const counts = `${plural(r.errorCount, 'error')}, ${plural(r.warningCount, 'warning')} (${r.meta.rulesRun} rules run)`;
  return r.errorCount > 0 ? c.red(`INVALID — ${counts}`) : c.green(`VALID — ${counts}`);
}

function validateCommand(args: string[], ctx: { out: Io['out']; err: Io['err']; color: boolean }): number {
  let file: string | undefined;
  let profile: Profile = 'xrechnung';
  let json = false;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--json') json = true;
    else if (a === '--quiet' || a === '-q') quiet = true;
    else if (a === '--profile' || a.startsWith('--profile=')) {
      const value = a.startsWith('--profile=') ? a.slice('--profile='.length) : args[++i];
      if (value !== 'xrechnung' && value !== 'en16931') {
        ctx.err(`invoicegate: --profile must be "xrechnung" or "en16931" (got "${value ?? ''}").`);
        return 2;
      }
      profile = value;
    } else if (a.startsWith('-')) {
      ctx.err(`invoicegate: unknown option "${a}" for validate.`);
      return 2;
    } else if (file === undefined) file = a;
    else {
      ctx.err(`invoicegate: validate takes a single file, got "${a}" as well as "${file}".`);
      return 2;
    }
  }

  if (file === undefined) {
    ctx.err('invoicegate: missing file. Usage: invoicegate validate <file.xml> [--profile xrechnung|en16931] [--json] [--quiet]');
    return 2;
  }

  let xml: string;
  try {
    xml = readFileSync(file, 'utf8');
  } catch (e) {
    ctx.err(`invoicegate: cannot read ${file}: ${errorMessage(e)}`);
    return 2;
  }

  const result = validateXml(xml, { profile });

  if (json) {
    ctx.out(JSON.stringify(result, null, 2));
  } else {
    const c = makeColors(ctx.color);
    if (!quiet) {
      const syntaxLabel = result.syntax === 'cii' ? 'CII/ZUGFeRD' : result.syntax === 'ubl' ? 'UBL' : 'unrecognised syntax';
      ctx.out(`${c.bold(file)}  ${c.dim(`syntax: ${syntaxLabel} | profile: ${result.profile} | ruleset: ${result.meta.rulesetVersion}`)}`);
      for (const v of result.violations) ctx.out(formatViolation(v, c));
    }
    ctx.out(summaryLine(result, c));
  }

  return result.errorCount > 0 ? 1 : 0;
}

/** Accept either the bare invoice object or a { "invoice": { ... } } wrapper. */
function unwrapInvoice(parsed: unknown): Record<string, unknown> | undefined {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const obj = parsed as Record<string, unknown>;
  const inner = obj['invoice'];
  if (typeof inner === 'object' && inner !== null && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return obj;
}

function generateCommand(args: string[], ctx: { out: Io['out']; err: Io['err'] }): number {
  let file: string | undefined;
  let outPath: string | undefined;
  let doValidate = true;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--no-validate') doValidate = false;
    else if (a === '-o' || a === '--output' || a.startsWith('--output=')) {
      const value = a.startsWith('--output=') ? a.slice('--output='.length) : args[++i];
      if (value === undefined || value === '') {
        ctx.err('invoicegate: -o needs a file path.');
        return 2;
      }
      outPath = value;
    } else if (a.startsWith('-')) {
      ctx.err(`invoicegate: unknown option "${a}" for generate.`);
      return 2;
    } else if (file === undefined) file = a;
    else {
      ctx.err(`invoicegate: generate takes a single file, got "${a}" as well as "${file}".`);
      return 2;
    }
  }

  if (file === undefined) {
    ctx.err('invoicegate: missing file. Usage: invoicegate generate <invoice.json> [-o out.xml] [--no-validate]');
    return 2;
  }

  let rawText: string;
  try {
    rawText = readFileSync(file, 'utf8');
  } catch (e) {
    ctx.err(`invoicegate: cannot read ${file}: ${errorMessage(e)}`);
    return 2;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    ctx.err(`invoicegate: ${file} is not valid JSON: ${errorMessage(e)}`);
    return 2;
  }

  const model = unwrapInvoice(parsed);
  if (model === undefined) {
    ctx.err(`invoicegate: ${file} must contain a JSON object — the invoice itself, or { "invoice": { ... } }.`);
    return 2;
  }

  let invoice: Invoice;
  let xml: string;
  try {
    invoice = withComputedTotals(withXRechnungDefaults(model as unknown as Invoice));
    xml = generateXRechnungUbl(invoice);
  } catch (e) {
    ctx.err(`invoicegate: could not generate XML from ${file}: ${errorMessage(e)}`);
    return 2;
  }

  // Always emit the XML, even when validation below fails.
  if (outPath !== undefined) {
    try {
      writeFileSync(outPath, xml, 'utf8');
    } catch (e) {
      ctx.err(`invoicegate: cannot write ${outPath}: ${errorMessage(e)}`);
      return 2;
    }
    ctx.err(`wrote ${outPath}`);
  } else {
    ctx.out(xml.endsWith('\n') ? xml.slice(0, -1) : xml);
  }

  if (doValidate) {
    const result = validateInvoice(invoice);
    if (result.errorCount > 0) {
      ctx.err(`invoicegate: generated document has ${plural(result.errorCount, 'validation error')}:`);
      for (const v of result.violations) {
        if (v.severity === 'error') ctx.err(`  ${v.ruleId}  ${v.message}`);
      }
      return 1;
    }
  }

  return 0;
}

/**
 * Run the CLI. Returns the exit code instead of setting it, so tests can
 * call this directly with captured Io.
 */
export async function run(argv: string[], io?: Io): Promise<number> {
  const out: Io['out'] = io?.out ?? ((line) => process.stdout.write(line + '\n'));
  const err: Io['err'] = io?.err ?? ((line) => process.stderr.write(line + '\n'));
  // Colors only for a real terminal; never when Io is injected (tests/pipes).
  const color = io === undefined && Boolean(process.stdout.isTTY) && process.env['NO_COLOR'] === undefined;

  const [command, ...rest] = argv;

  try {
    if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
      out(USAGE);
      return 0;
    }
    if (command === '--version' || command === '-v') {
      out(readOwnVersion());
      return 0;
    }
    switch (command) {
      case 'validate':
        return validateCommand(rest, { out, err, color });
      case 'generate':
        return generateCommand(rest, { out, err });
      default:
        err(`invoicegate: unknown command "${command}". Run \`invoicegate --help\` for usage.`);
        return 2;
    }
  } catch (e) {
    // Last-resort guard: nothing above should throw, but never crash the CLI.
    err(`invoicegate: ${errorMessage(e)}`);
    return 2;
  }
}

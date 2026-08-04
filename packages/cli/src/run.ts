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
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compareRulesets,
  generateXRechnungUbl,
  fixXml,
  listRulesets,
  locateViolations,
  parseCiiInvoice,
  parseUblInvoice,
  validateInvoice,
  validateXml,
  withComputedTotals,
  withXRechnungDefaults,
} from '@invoicegate/core';
import type {
  DocumentInput,
  Invoice,
  LocatedViolation,
  Profile,
  RegressionReport,
  ValidateXmlResult,
  ValidationResult,
  Violation,
} from '@invoicegate/core';
import { formatGithub, formatSarif, type FileReport } from './report.js';

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
  invoicegate validate <file.xml|dir...> [--profile xrechnung|en16931]
                       [--format human|json|github|sarif] [--fail-on error|warning]
                       [--max-annotations <n>] [--json] [--quiet]
  invoicegate fix <file.xml|dir...> [--write] [--profile xrechnung|en16931] [--json]
  invoicegate generate <invoice.json> [-o out.xml] [--no-validate]
  invoicegate regress <dir|file...> --from <ruleset> --to <ruleset> [--json] [--quiet]
  invoicegate rulesets
  invoicegate --version
  invoicegate --help

Commands:
  validate   Check UBL or CII (ZUGFeRD / Factur-X) invoices against the
             EN 16931 business rules, plus the German BR-DE rules when the
             profile is xrechnung (the default). Accepts files and directories.
  fix        Repair the problems that have one correct answer — totals and VAT
             amounts that disagree with the figures they are computed from —
             by editing those values in the file and nothing else. Anything
             needing a human decision is reported, never guessed. Shows what it
             would change; pass --write to apply it.
  generate   Build XRechnung 3.0 UBL XML from a JSON semantic model
             (either the bare invoice object or { "invoice": { ... } }).
  regress    Re-check a folder of invoices against a different rule set and
             report which documents would START failing. Use it before a new
             specification takes effect, so you fix invoices on your schedule
             instead of on the switchover date.
  rulesets   List the rule sets available to --from / --to.

Output formats (validate):
  human    Readable report with line numbers (default).
  json     Machine-readable, including a location for every violation.
  github   GitHub Actions workflow commands — annotates the pull request
           on the exact line of the offending element.
  sarif    SARIF 2.1.0, for GitHub code scanning and other CI systems.

  A line marked "~" is approximate: the field is absent from the document,
  so the nearest enclosing element is reported instead.

Exit codes:
  0  valid / success / no regressions / nothing left to fix
  1  validation errors found / regressions found / fixes outstanding
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

function formatViolation(v: Violation | LocatedViolation, c: Colors): string {
  const badge = v.severity === 'error' ? c.red('ERROR') : c.yellow('WARN ');
  const located = 'location' in v ? v.location : undefined;
  // An approximate line is labelled as such — "~" reads as "near here", and a
  // reviewer who is silently sent to the wrong line stops trusting the tool.
  const where = located
    ? c.dim(` (${located.precision === 'exact' ? '' : '~'}line ${located.line})`)
    : v.path
      ? c.dim(` (${v.path})`)
      : '';
  return `  ${badge}  ${c.bold(v.ruleId)}  ${v.message}${where}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function summaryLine(r: ValidationResult, c: Colors): string {
  const counts = `${plural(r.errorCount, 'error')}, ${plural(r.warningCount, 'warning')} (${r.meta.rulesRun} rules run)`;
  return r.errorCount > 0 ? c.red(`INVALID — ${counts}`) : c.green(`VALID — ${counts}`);
}

type OutputFormat = 'human' | 'json' | 'github' | 'sarif';

const OUTPUT_FORMATS = new Set<string>(['human', 'json', 'github', 'sarif']);

function validateCommand(args: string[], ctx: { out: Io['out']; err: Io['err']; color: boolean }): number {
  const paths: string[] = [];
  let profile: Profile = 'xrechnung';
  let format: OutputFormat = 'human';
  let quiet = false;
  let failOn: 'error' | 'warning' = 'error';
  let maxAnnotations = Number.POSITIVE_INFINITY;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--json') format = 'json';
    else if (a === '--quiet' || a === '-q') quiet = true;
    else if (a === '--format' || a.startsWith('--format=')) {
      const value = a.startsWith('--format=') ? a.slice('--format='.length) : args[++i];
      if (value === undefined || !OUTPUT_FORMATS.has(value)) {
        ctx.err(`invoicegate: --format must be one of human, json, github, sarif (got "${value ?? ''}").`);
        return 2;
      }
      format = value as OutputFormat;
    } else if (a === '--fail-on' || a.startsWith('--fail-on=')) {
      const value = a.startsWith('--fail-on=') ? a.slice('--fail-on='.length) : args[++i];
      if (value !== 'error' && value !== 'warning') {
        ctx.err(`invoicegate: --fail-on must be "error" or "warning" (got "${value ?? ''}").`);
        return 2;
      }
      failOn = value;
    } else if (a === '--max-annotations' || a.startsWith('--max-annotations=')) {
      const value = a.startsWith('--max-annotations=') ? a.slice('--max-annotations='.length) : args[++i];
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        ctx.err(`invoicegate: --max-annotations must be a non-negative integer (got "${value ?? ''}").`);
        return 2;
      }
      maxAnnotations = parsed;
    } else if (a === '--profile' || a.startsWith('--profile=')) {
      const value = a.startsWith('--profile=') ? a.slice('--profile='.length) : args[++i];
      if (value !== 'xrechnung' && value !== 'en16931') {
        ctx.err(`invoicegate: --profile must be "xrechnung" or "en16931" (got "${value ?? ''}").`);
        return 2;
      }
      profile = value;
    } else if (a.startsWith('-')) {
      ctx.err(`invoicegate: unknown option "${a}" for validate.`);
      return 2;
    } else paths.push(a);
  }

  if (paths.length === 0) {
    ctx.err(
      'invoicegate: missing file. Usage: invoicegate validate <file.xml|dir...> [--profile xrechnung|en16931] [--format human|json|github|sarif] [--fail-on error|warning] [--quiet]',
    );
    return 2;
  }

  // A single explicit file is read directly, so a non-XML filename the user
  // named on purpose is still validated (and its read error still reported).
  let files: string[];
  const singleExplicitFile = paths.length === 1 && isFile(paths[0]!);
  if (singleExplicitFile) {
    files = [paths[0]!];
  } else {
    try {
      files = collectXmlFiles(paths);
    } catch (e) {
      ctx.err(`invoicegate: cannot read input: ${errorMessage(e)}`);
      return 2;
    }
    if (files.length === 0) {
      ctx.err(`invoicegate: no .xml files found in ${paths.join(', ')}.`);
      return 2;
    }
  }

  const reports: FileReport[] = [];
  const results: ValidateXmlResult[] = [];
  for (const file of files) {
    let xml: string;
    try {
      xml = readFileSync(file, 'utf8');
    } catch (e) {
      ctx.err(`invoicegate: cannot read ${file}: ${errorMessage(e)}`);
      return 2;
    }
    const result = validateXml(xml, { profile });
    // Without a recognised syntax there is nothing to index, so violations
    // keep their document-level fallback rather than a fabricated position.
    const located = locateViolations(xml, result.violations, result.syntax ?? 'ubl');
    results.push(result);
    reports.push({ file, profile: result.profile, violations: located });
  }

  const totals = {
    errors: results.reduce((n, r) => n + r.errorCount, 0),
    warnings: results.reduce((n, r) => n + r.warningCount, 0),
  };

  const c = makeColors(ctx.color);
  // A plain-text tally on stderr survives GitHub's annotation rendering limits
  // and SARIF post-processing, so the log always states the true totals.
  const emitTally = (): void => {
    ctx.err(
      `invoicegate: ${plural(totals.errors, 'error')}, ${plural(totals.warnings, 'warning')} in ${plural(reports.length, 'file')}.`,
    );
  };

  switch (format) {
    case 'json': {
      if (singleExplicitFile) {
        // The long-standing single-file shape, with locations added.
        ctx.out(JSON.stringify({ ...results[0]!, violations: reports[0]!.violations }, null, 2));
      } else {
        ctx.out(
          JSON.stringify(
            {
              files: reports.map((r, i) => ({ file: r.file, ...results[i]!, violations: r.violations })),
              summary: { files: reports.length, ...totals },
            },
            null,
            2,
          ),
        );
      }
      break;
    }
    case 'github': {
      const { lines, suppressed } = formatGithub(reports, { limit: maxAnnotations });
      for (const line of lines) ctx.out(line);
      if (suppressed > 0) {
        ctx.err(`invoicegate: ${suppressed} further problems not annotated (--max-annotations ${maxAnnotations}).`);
      }
      emitTally();
      break;
    }
    case 'sarif': {
      ctx.out(formatSarif(reports, { version: readOwnVersion() }));
      emitTally();
      break;
    }
    case 'human': {
      for (const [i, report] of reports.entries()) {
        const result = results[i]!;
        if (!quiet) {
          const syntaxLabel =
            result.syntax === 'cii' ? 'CII/ZUGFeRD' : result.syntax === 'ubl' ? 'UBL' : 'unrecognised syntax';
          ctx.out(
            `${c.bold(report.file)}  ${c.dim(`syntax: ${syntaxLabel} | profile: ${result.profile} | ruleset: ${result.meta.rulesetVersion}`)}`,
          );
          for (const v of report.violations) ctx.out(formatViolation(v, c));
        }
        if (reports.length === 1) ctx.out(summaryLine(result, c));
      }
      if (reports.length > 1) {
        const counts = `${plural(totals.errors, 'error')}, ${plural(totals.warnings, 'warning')} across ${plural(reports.length, 'file')}`;
        ctx.out(totals.errors > 0 ? c.red(`INVALID — ${counts}`) : c.green(`VALID — ${counts}`));
      }
      break;
    }
  }

  if (totals.errors > 0) return 1;
  return failOn === 'warning' && totals.warnings > 0 ? 1 : 0;
}

// ————————————————————————————————————————————————————————————————
// regress — will my invoices survive the next rule set?
// ————————————————————————————————————————————————————————————————

/** True when the path exists and is a regular file. */
function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Collect .xml files from a list of files and/or directories (recursively). */
function collectXmlFiles(paths: string[]): string[] {
  const found: string[] = [];
  const walk = (p: string): void => {
    const stat = statSync(p);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(p).sort()) walk(join(p, entry));
    } else if (p.toLowerCase().endsWith('.xml')) {
      found.push(p);
    }
  };
  for (const p of paths) walk(p);
  return found;
}

function parseAnyInvoice(xml: string): Invoice {
  return /CrossIndustryInvoice[\s>]/.test(xml.slice(0, 4000))
    ? parseCiiInvoice(xml)
    : parseUblInvoice(xml);
}

function rulesetsCommand(ctx: { out: Io['out']; color: boolean }): number {
  const c = makeColors(ctx.color);
  ctx.out(c.bold('Available rule sets'));
  for (const r of listRulesets()) {
    const effective = r.effectiveFrom ? ` since ${r.effectiveFrom}` : '';
    ctx.out(`  ${c.bold(r.id.padEnd(22))} ${r.label}`);
    ctx.out(`  ${' '.repeat(22)} ${c.dim(`${r.specVersion} · ${r.status}${effective} · ${r.rules.length} rules`)}`);
  }
  return 0;
}

function formatRegressionReport(report: RegressionReport, c: Colors): string[] {
  const lines: string[] = [];
  const s = report.summary;
  lines.push(
    `${c.bold(report.from.id)} ${c.dim('→')} ${c.bold(report.to.id)}  ${c.dim(
      `(${report.from.rulesRun} → ${report.to.rulesRun} rules)`,
    )}`,
  );
  lines.push('');

  if (s.regressions > 0) {
    lines.push(
      c.red(
        `${plural(s.regressions, 'document')} would START failing under ${report.to.specVersion}.`,
      ),
    );
    lines.push('');
    lines.push(c.bold('Fix these rules first (most documents affected):'));
    for (const r of report.byNewRule) {
      lines.push(`  ${c.red(r.ruleId.padEnd(12))} ${plural(r.documents, 'document')}  ${c.dim(r.message)}`);
    }
    lines.push('');
    lines.push(c.bold('Affected documents:'));
    for (const e of report.entries.filter((x) => x.transition === 'regression')) {
      lines.push(`  ${e.id}  ${c.dim(e.newRuleIds.join(', '))}`);
    }
    lines.push('');
  } else {
    lines.push(c.green(`No regressions — every valid document stays valid under ${report.to.specVersion}.`));
    lines.push('');
  }

  lines.push(
    c.dim(
      `${s.total} checked · ${s.regressions} regressions · ${s.improvements} improvements · ` +
        `${s.unchangedPass} unchanged pass · ${s.unchangedFail} unchanged fail`,
    ),
  );
  return lines;
}

function regressCommand(args: string[], ctx: { out: Io['out']; err: Io['err']; color: boolean }): number {
  const paths: string[] = [];
  let from: string | undefined;
  let to: string | undefined;
  let json = false;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--json') json = true;
    else if (a === '--quiet' || a === '-q') quiet = true;
    else if (a === '--from' || a.startsWith('--from=')) {
      from = a.startsWith('--from=') ? a.slice('--from='.length) : args[++i];
    } else if (a === '--to' || a.startsWith('--to=')) {
      to = a.startsWith('--to=') ? a.slice('--to='.length) : args[++i];
    } else if (a.startsWith('-')) {
      ctx.err(`invoicegate: unknown option "${a}" for regress.`);
      return 2;
    } else paths.push(a);
  }

  if (paths.length === 0 || from === undefined || to === undefined) {
    ctx.err(
      'invoicegate: usage: invoicegate regress <dir|file...> --from <ruleset> --to <ruleset>\n' +
        '            Run `invoicegate rulesets` to see the available rule sets.',
    );
    return 2;
  }

  let files: string[];
  try {
    files = collectXmlFiles(paths);
  } catch (e) {
    ctx.err(`invoicegate: cannot read input: ${errorMessage(e)}`);
    return 2;
  }
  if (files.length === 0) {
    ctx.err(`invoicegate: no .xml files found in ${paths.join(', ')}.`);
    return 2;
  }

  const documents: DocumentInput[] = [];
  const unreadable: string[] = [];
  for (const file of files) {
    try {
      documents.push({ id: file, invoice: parseAnyInvoice(readFileSync(file, 'utf8')) });
    } catch (e) {
      // A document we cannot parse is reported, not silently dropped — a
      // regression run that quietly skips files would be worse than useless.
      unreadable.push(`${file}: ${errorMessage(e)}`);
    }
  }

  let report: RegressionReport;
  try {
    report = compareRulesets(documents, from, to);
  } catch (e) {
    ctx.err(`invoicegate: ${errorMessage(e)}`);
    return 2;
  }

  if (json) {
    ctx.out(JSON.stringify({ ...report, unreadable }, null, 2));
  } else {
    const c = makeColors(ctx.color);
    if (!quiet) for (const line of formatRegressionReport(report, c)) ctx.out(line);
    else ctx.out(`${report.summary.regressions} regressions in ${report.summary.total} documents`);
    for (const u of unreadable) ctx.err(`  ${makeColors(ctx.color).yellow('SKIPPED')} ${u}`);
  }

  return report.summary.regressions > 0 ? 1 : 0;
}

// ————————————————————————————————————————————————————————————————
// fix — repair what can be repaired, refuse the rest
// ————————————————————————————————————————————————————————————————

function fixCommand(args: string[], ctx: { out: Io['out']; err: Io['err']; color: boolean }): number {
  const paths: string[] = [];
  let profile: Profile = 'xrechnung';
  let write = false;
  let json = false;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--write' || a === '-w') write = true;
    else if (a === '--json') json = true;
    else if (a === '--quiet' || a === '-q') quiet = true;
    else if (a === '--profile' || a.startsWith('--profile=')) {
      const value = a.startsWith('--profile=') ? a.slice('--profile='.length) : args[++i];
      if (value !== 'xrechnung' && value !== 'en16931') {
        ctx.err(`invoicegate: --profile must be "xrechnung" or "en16931" (got "${value ?? ''}").`);
        return 2;
      }
      profile = value;
    } else if (a.startsWith('-')) {
      ctx.err(`invoicegate: unknown option "${a}" for fix.`);
      return 2;
    } else paths.push(a);
  }

  if (paths.length === 0) {
    ctx.err('invoicegate: missing file. Usage: invoicegate fix <file.xml|dir...> [--write] [--profile xrechnung|en16931] [--json]');
    return 2;
  }

  let files: string[];
  if (paths.length === 1 && isFile(paths[0]!)) files = [paths[0]!];
  else {
    try {
      files = collectXmlFiles(paths);
    } catch (e) {
      ctx.err(`invoicegate: cannot read input: ${errorMessage(e)}`);
      return 2;
    }
    if (files.length === 0) {
      ctx.err(`invoicegate: no .xml files found in ${paths.join(', ')}.`);
      return 2;
    }
  }

  const c = makeColors(ctx.color);
  const report: {
    file: string;
    applied: { line: number; ruleId: string; previous: string; replacement: string }[];
    unfixable: { ruleId: string; reason: string; message: string }[];
    valid: boolean;
    written: boolean;
  }[] = [];
  let totalFixes = 0;
  let totalRemaining = 0;
  let failedWrite = false;

  for (const file of files) {
    let xml: string;
    try {
      xml = readFileSync(file, 'utf8');
    } catch (e) {
      ctx.err(`invoicegate: cannot read ${file}: ${errorMessage(e)}`);
      return 2;
    }

    const result = fixXml(xml, { profile });
    // Warnings are never repaired, so "remaining" counts errors only.
    const remaining = result.unfixable.filter((u) => result.errorsAfter > 0);
    totalFixes += result.applied.length;
    totalRemaining += result.errorsAfter;

    let written = false;
    if (write && result.applied.length > 0) {
      try {
        writeFileSync(file, result.xml, 'utf8');
        written = true;
      } catch (e) {
        ctx.err(`invoicegate: cannot write ${file}: ${errorMessage(e)}`);
        failedWrite = true;
      }
    }

    report.push({
      file,
      applied: result.applied.map((e) => ({
        line: e.line,
        ruleId: e.ruleId,
        previous: e.previous,
        replacement: e.replacement,
      })),
      unfixable: remaining.map((u) => ({ ruleId: u.ruleId, reason: u.reason, message: u.message })),
      valid: result.valid,
      written,
    });
  }

  if (failedWrite) return 2;

  if (json) {
    ctx.out(
      JSON.stringify(
        { files: report, summary: { files: report.length, fixes: totalFixes, errorsRemaining: totalRemaining, written: write } },
        null,
        2,
      ),
    );
  } else if (!quiet) {
    for (const entry of report) {
      if (entry.applied.length === 0 && entry.unfixable.length === 0) continue;
      ctx.out(c.bold(entry.file));
      for (const e of entry.applied) {
        ctx.out(`  ${c.green('fix')}   line ${String(e.line).padEnd(5)} ${c.bold(e.ruleId)}  ${e.previous} → ${c.bold(e.replacement)}`);
      }
      for (const u of entry.unfixable) {
        ctx.out(`  ${c.yellow('keep')}  ${' '.repeat(10)}${c.bold(u.ruleId)}  ${c.dim(u.reason)}`);
      }
    }
  }

  if (!json) {
    const verb = write ? 'applied' : 'available';
    const fixes = `${totalFixes} fix${totalFixes === 1 ? '' : 'es'}`;
    const summary = `${fixes} ${verb}, ${plural(totalRemaining, 'error')} needing a person`;
    if (totalFixes === 0 && totalRemaining === 0) ctx.out(c.green('Nothing to fix.'));
    else ctx.out(totalRemaining > 0 ? c.yellow(summary) : c.green(summary));
    if (!write && totalFixes > 0) ctx.err('invoicegate: nothing was written — re-run with --write to apply these fixes.');
  }

  // Preview mode fails the build when work is outstanding, like a --check flag;
  // with --write only genuinely unrepairable problems fail it.
  if (write) return totalRemaining > 0 ? 1 : 0;
  return totalFixes > 0 || totalRemaining > 0 ? 1 : 0;
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
      case 'fix':
        return fixCommand(rest, { out, err, color });
      case 'regress':
        return regressCommand(rest, { out, err, color });
      case 'rulesets':
        return rulesetsCommand({ out, color });
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

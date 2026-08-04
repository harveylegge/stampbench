#!/usr/bin/env node
/**
 * run.mjs — dual-run the official KoSIT validator and @stampbench/core over
 * the official XRechnung test-suite and emit a machine-readable delta report.
 *
 * Prerequisites: `node tools/parity/download.mjs` (creates vendor/), Java 17+
 * on PATH (unless --skip-kosit), packages/core built (dist/ present).
 *
 * Usage:
 *   node tools/parity/run.mjs [--limit N] [--skip-kosit] [--java <path-to-java>]
 *
 *   --limit N      only run the first N instances (interleaved UBL/CII) — for
 *                  quick local smoke runs. The published report must be a full run.
 *   --skip-kosit   run only the Stampbench half; every KoSIT verdict is
 *                  recorded literally as "skipped" and NO agreement numbers are
 *                  computed. Exists so the harness can be exercised on machines
 *                  without Java. Never a substitute for the real comparison.
 *
 * Output: tools/parity/report/parity-report.json and tools/parity/report/summary.md
 *
 * Honesty rules baked in:
 *   - agreement is only computed for files where BOTH validators produced a
 *     definite verdict; everything else is counted separately, never imputed.
 *   - divergences are broken down by rule id (topDivergentRules), because
 *     @stampbench/core implements a documented subset of the rules and the
 *     interesting question is *which* rules diverge, not just how many files.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const vendorDir = join(here, 'vendor');
const reportDir = join(here, 'report');
const workDir = join(vendorDir, 'work');

// ---------- args ----------
const argv = process.argv.slice(2);
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}
const limit = argValue('--limit') ? Number(argValue('--limit')) : undefined;
const skipKosit = argv.includes('--skip-kosit');
const javaCmd = argValue('--java') ?? 'java';

function log(msg) {
  console.log(`[parity:run] ${msg}`);
}
function fail(msg) {
  console.error(`[parity:run] ERROR: ${msg}`);
  process.exit(1);
}

// ---------- load pinned versions + vendor manifest ----------
const versions = JSON.parse(readFileSync(join(here, 'VERSIONS.json'), 'utf8'));
const manifestPath = join(vendorDir, 'manifest.json');
if (!existsSync(manifestPath)) fail('vendor/manifest.json missing — run tools/parity/download.mjs first');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const jarPath = join(here, manifest.jar);
const scenariosXml = join(here, manifest.scenariosXml);
const repositoryDir = join(here, manifest.repositoryDir);
const testsuiteDir = join(here, manifest.testsuiteDir);

// ---------- load our validator ----------
const coreEntry = join(repoRoot, 'packages', 'core', 'dist', 'index.js');
if (!existsSync(coreEntry)) fail(`@stampbench/core not built: ${coreEntry} missing (run: npm run build -w @stampbench/core)`);
const core = await import(pathToFileURL(coreEntry).href);
if (typeof core.validateXml !== 'function') fail('@stampbench/core dist does not export validateXml');

// ---------- collect test instances ----------
/**
 * An "instance" is any XML file in the test-suite whose root element is a UBL
 * Invoice/CreditNote or a CII CrossIndustryInvoice. Everything else (docs,
 * scenario files, reports) is skipped. This sniff keeps the harness robust to
 * test-suite layout changes between releases.
 */
function sniffSyntax(filePath) {
  const head = readFileSync(filePath, 'utf8').slice(0, 8192);
  // First real element after prolog/comments/PIs.
  const m = /<(?!\?|!)(?:[\w.-]+:)?(\w[\w.-]*)[\s>]/.exec(head);
  if (!m) return null;
  const root = m[1];
  if (root === 'Invoice' || root === 'CreditNote') return 'ubl';
  if (root === 'CrossIndustryInvoice') return 'cii';
  return null;
}

function walkXmlFiles(root, acc = [], base = root) {
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) walkXmlFiles(full, acc, base);
    else if (entry.name.endsWith('.xml')) acc.push(full);
  }
  return acc;
}

const allXml = walkXmlFiles(testsuiteDir);
let instances = [];
for (const file of allXml) {
  const syntax = sniffSyntax(file);
  if (syntax) instances.push({ file, rel: relative(testsuiteDir, file).replaceAll('\\', '/'), syntax });
}
instances.sort((a, b) => a.rel.localeCompare(b.rel));
const totalFound = { ubl: instances.filter((i) => i.syntax === 'ubl').length, cii: instances.filter((i) => i.syntax === 'cii').length };
log(`test-suite instances found: ${instances.length} (${totalFound.ubl} UBL, ${totalFound.cii} CII) out of ${allXml.length} XML files`);
if (instances.length === 0) fail('no invoice instances found in the test-suite — extraction broken?');

if (limit && limit > 0 && limit < instances.length) {
  // Interleave UBL and CII so a small smoke run still exercises both syntaxes.
  const ubl = instances.filter((i) => i.syntax === 'ubl');
  const cii = instances.filter((i) => i.syntax === 'cii');
  const picked = [];
  for (let i = 0; picked.length < limit && (i < ubl.length || i < cii.length); i++) {
    if (i < ubl.length && picked.length < limit) picked.push(ubl[i]);
    if (i < cii.length && picked.length < limit) picked.push(cii[i]);
  }
  instances = picked.sort((a, b) => a.rel.localeCompare(b.rel));
  log(`--limit ${limit}: running ${instances.length} instances (${instances.filter((i) => i.syntax === 'ubl').length} UBL, ${instances.filter((i) => i.syntax === 'cii').length} CII)`);
}

// ---------- Stampbench half ----------
for (const inst of instances) {
  const xml = readFileSync(inst.file, 'utf8');
  try {
    const r = core.validateXml(xml);
    inst.stampbench = r.valid ? 'valid' : 'invalid';
    inst.stampbenchRuleIds = [...new Set(r.violations.filter((v) => v.severity === 'error').map((v) => v.ruleId))].sort();
    inst.stampbenchSyntax = r.syntax ?? null;
  } catch (e) {
    inst.stampbench = 'error';
    inst.stampbenchRuleIds = [];
    inst.stampbenchError = String(e?.message ?? e).slice(0, 300);
  }
}
log(`Stampbench half done: ${instances.filter((i) => i.stampbench === 'valid').length} valid, ${instances.filter((i) => i.stampbench === 'invalid').length} invalid, ${instances.filter((i) => i.stampbench === 'error').length} errors`);

// ---------- KoSIT half ----------
let javaVersion = null;
if (!skipKosit) {
  const jv = spawnSync(javaCmd, ['-version'], { encoding: 'utf8' });
  if (jv.error) fail(`java not found (${jv.error.message}). Install Java 17+ or pass --skip-kosit / --java <path>.`);
  javaVersion = (jv.stderr || jv.stdout || '').split('\n')[0].trim();
  log(`using ${javaVersion}`);

  // Stage instances under unique names so batch reports can't collide, then
  // run the validator in batches:  java -jar validator.jar -s scenarios.xml -r <repo> -o <reports> <files...>
  // Per KoSIT CLI docs: one <staged-name>-report.xml per input in -o, exit code = number of rejected files.
  const stagingDir = join(workDir, 'instances');
  const kositReportDir = join(workDir, 'kosit-reports');
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  mkdirSync(kositReportDir, { recursive: true });
  instances.forEach((inst, i) => {
    inst.staged = `${String(i).padStart(4, '0')}__${basename(inst.file)}`;
    copyFileSync(inst.file, join(stagingDir, inst.staged));
  });

  const CHUNK = 80;
  for (let at = 0; at < instances.length; at += CHUNK) {
    const chunk = instances.slice(at, at + CHUNK);
    const args = ['-jar', jarPath, '-s', scenariosXml, '-r', repositoryDir, '-o', kositReportDir, ...chunk.map((c) => c.staged)];
    log(`KoSIT batch ${at / CHUNK + 1}/${Math.ceil(instances.length / CHUNK)} (${chunk.length} files)...`);
    const r = spawnSync(javaCmd, args, { cwd: stagingDir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    if (r.error) fail(`java invocation failed: ${r.error.message}`);
    // Exit code semantics: 0 = all accepted, N>0 = N rejected, negative = config/parse error.
    if (r.status !== null && (r.status === 255 || r.status === 254 || r.status < 0)) {
      fail(`KoSIT validator configuration/startup error (exit ${r.status}).\nstderr: ${(r.stderr ?? '').slice(0, 2000)}`);
    }
  }

  // If not a single expected report exists, the CLI contract changed (naming,
  // flags) — fail loudly rather than emit a report full of silent errors.
  if (!instances.some((inst) => existsSync(join(kositReportDir, inst.staged.replace(/\.xml$/, '-report.xml'))))) {
    const produced = readdirSync(kositReportDir).slice(0, 10);
    fail(`KoSIT produced none of the expected <name>-report.xml files. Files in report dir: ${produced.join(', ') || '(none)'}`);
  }

  for (const inst of instances) {
    const reportFile = join(kositReportDir, inst.staged.replace(/\.xml$/, '-report.xml'));
    if (!existsSync(reportFile)) {
      inst.kosit = 'error';
      inst.kositError = 'no report produced';
      continue;
    }
    const parsed = parseKositReport(readFileSync(reportFile, 'utf8'));
    inst.kosit = parsed.verdict; // 'accept' | 'reject' | 'unknown'
    inst.kositRuleIds = parsed.errorCodes;
  }
  const counts = { accept: 0, reject: 0, unknown: 0, error: 0 };
  for (const inst of instances) counts[inst.kosit] = (counts[inst.kosit] ?? 0) + 1;
  log(`KoSIT half done: ${counts.accept} accept, ${counts.reject} reject, ${counts.unknown} unknown, ${counts.error} errors`);
} else {
  for (const inst of instances) inst.kosit = 'skipped';
  log('KoSIT half SKIPPED (--skip-kosit): no agreement numbers will be computed.');
}

/**
 * Parse a KoSIT "varl" report XML (namespace http://www.xoev.de/de/validator/varl/1).
 * Verdict: <assessment> contains either an <accept> or a <reject> element.
 * Error codes: <message code="BR-.." level="error"> elements (schematron rule ids).
 * Namespace prefixes are matched generically.
 */
function parseKositReport(xml) {
  const assessmentMatch = /<(?:[\w.-]+:)?assessment\b[\s\S]*?<\/(?:[\w.-]+:)?assessment>/.exec(xml);
  const scope = assessmentMatch ? assessmentMatch[0] : xml;
  const reject = /<(?:[\w.-]+:)?reject\b/.test(scope);
  const accept = /<(?:[\w.-]+:)?accept\b/.test(scope);
  const verdict = reject ? 'reject' : accept ? 'accept' : 'unknown';
  const codes = new Set();
  const msgRe = /<(?:[\w.-]+:)?message\b([^>]*)>/g;
  let m;
  while ((m = msgRe.exec(xml))) {
    const attrs = m[1];
    const level = /\blevel="([^"]*)"/.exec(attrs)?.[1];
    const code = /\bcode="([^"]*)"/.exec(attrs)?.[1];
    if (code && level === 'error') codes.add(code);
  }
  return { verdict, errorCodes: [...codes].sort() };
}

// ---------- delta ----------
const files = instances.map((inst) => {
  const definite = (inst.kosit === 'accept' || inst.kosit === 'reject') && (inst.stampbench === 'valid' || inst.stampbench === 'invalid');
  const agreement = definite ? (inst.kosit === 'accept') === (inst.stampbench === 'valid') : null;
  return {
    file: inst.rel,
    syntax: inst.syntax,
    kosit: inst.kosit,
    stampbench: inst.stampbench,
    agreement,
    kositRuleIds: inst.kositRuleIds ?? undefined,
    stampbenchRuleIds: inst.stampbenchRuleIds ?? undefined,
    stampbenchError: inst.stampbenchError ?? undefined,
    kositError: inst.kositError ?? undefined,
  };
});

const comparable = files.filter((f) => f.agreement !== null);
const agree = comparable.filter((f) => f.agreement).length;
const falseGreens = comparable.filter((f) => f.kosit === 'reject' && f.stampbench === 'valid');
const falseAlarms = comparable.filter((f) => f.kosit === 'accept' && f.stampbench === 'invalid');
const notComparable = files.length - comparable.length;

// Rule-id breakdown of divergences. For false-greens the informative side is
// what KoSIT flagged (rules we're missing/weaker on); for false-alarms it's
// what *we* flagged (rules where we're stricter/wrong).
const ruleCounts = new Map();
for (const f of falseGreens) {
  for (const id of f.kositRuleIds ?? []) {
    const key = `${id} kosit-only`;
    ruleCounts.set(key, (ruleCounts.get(key) ?? 0) + 1);
  }
}
for (const f of falseAlarms) {
  for (const id of f.stampbenchRuleIds ?? []) {
    const key = `${id} stampbench-only`;
    ruleCounts.set(key, (ruleCounts.get(key) ?? 0) + 1);
  }
}
const topDivergentRules = [...ruleCounts.entries()]
  .map(([key, count]) => {
    const [ruleId, direction] = key.split(' ');
    return { ruleId, direction, files: count };
  })
  .sort((a, b) => b.files - a.files || a.ruleId.localeCompare(b.ruleId))
  .slice(0, 20);

const summary = {
  total: files.length,
  comparable: comparable.length,
  agree,
  koSitRejectWeAccept: falseGreens.length,
  koSitAcceptWeReject: falseAlarms.length,
  notComparable,
  agreementRate: comparable.length > 0 ? Number((agree / comparable.length).toFixed(4)) : null,
  topDivergentRules,
};

const report = {
  generatedAt: new Date().toISOString(),
  mode: { skipKosit, limit: limit ?? null, fullCorpus: !limit || limit >= totalFound.ubl + totalFound.cii },
  corpus: {
    testsuite: `${versions.testsuite.repo}@${versions.testsuite.tag}`,
    xrechnungVersion: versions.testsuite.xrechnungVersion,
    instancesFound: totalFound,
    instancesRun: files.length,
  },
  tools: {
    kositValidator: skipKosit ? null : `${versions.validator.repo}@${versions.validator.tag}`,
    kositConfiguration: skipKosit ? null : `${versions.configuration.repo}@${versions.configuration.tag}`,
    java: javaVersion,
    stampbenchCore: `@stampbench/core ruleset ${core.RULESET_VERSION ?? 'unknown'}`,
    node: process.version,
  },
  summary,
  files,
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, 'parity-report.json'), JSON.stringify(report, null, 2) + '\n');

// ---------- human summary ----------
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const lines = [];
lines.push('# KoSIT parity report');
lines.push('');
if (skipKosit) {
  lines.push('> **KoSIT half was skipped** (`--skip-kosit`). This run only exercises the Stampbench half of the pipeline. There are **no parity numbers** in this report.');
  lines.push('');
}
if (limit && !report.mode.fullCorpus) {
  lines.push(`> **Partial run** (\`--limit ${limit}\`): ${files.length} of ${totalFound.ubl + totalFound.cii} instances. Do not publish partial numbers as parity results.`);
  lines.push('');
}
lines.push(`- Corpus: \`${report.corpus.testsuite}\` (XRechnung ${report.corpus.xrechnungVersion}) — ${files.length} instances run (${files.filter((f) => f.syntax === 'ubl').length} UBL, ${files.filter((f) => f.syntax === 'cii').length} CII)`);
lines.push(`- Reference: ${skipKosit ? '_skipped_' : `\`${report.tools.kositValidator}\` with \`${report.tools.kositConfiguration}\` (${javaVersion})`}`);
lines.push(`- Ours: \`${report.tools.stampbenchCore}\` (node ${process.version})`);
lines.push(`- Generated: ${report.generatedAt}`);
lines.push('');
lines.push('| Metric | Value |');
lines.push('| --- | --- |');
lines.push(`| Instances run | ${summary.total} |`);
lines.push(`| Comparable (definite verdict on both sides) | ${summary.comparable} |`);
lines.push(`| Agree | ${summary.agree} |`);
lines.push(`| KoSIT rejects, we accept (**false green** — dangerous) | ${summary.koSitRejectWeAccept} |`);
lines.push(`| KoSIT accepts, we reject (false alarm) | ${summary.koSitAcceptWeReject} |`);
lines.push(`| Not comparable (skipped/error/unknown) | ${summary.notComparable} |`);
lines.push(`| **Agreement rate** | ${summary.agreementRate === null ? 'n/a' : pct(summary.agreementRate)} |`);
lines.push('');
if (topDivergentRules.length > 0) {
  lines.push('## Top divergent rules');
  lines.push('');
  lines.push('`kosit-only` = KoSIT flags this rule on files we accept (coverage gap on our side). `stampbench-only` = we flag it on files KoSIT accepts (we are stricter or wrong).');
  lines.push('');
  lines.push('| Rule | Direction | Files |');
  lines.push('| --- | --- | --- |');
  for (const r of topDivergentRules) lines.push(`| ${r.ruleId} | ${r.direction} | ${r.files} |`);
  lines.push('');
}
const divergent = [...falseGreens, ...falseAlarms];
if (divergent.length > 0) {
  lines.push('## Divergent files');
  lines.push('');
  lines.push('| File | Syntax | KoSIT | Stampbench | Rule ids (flagging side) |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const f of divergent.slice(0, 60)) {
    const ids = (f.kosit === 'reject' ? f.kositRuleIds : f.stampbenchRuleIds) ?? [];
    lines.push(`| ${f.file} | ${f.syntax} | ${f.kosit} | ${f.stampbench} | ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? ', …' : ''} |`);
  }
  if (divergent.length > 60) lines.push(`| … ${divergent.length - 60} more — see parity-report.json | | | | |`);
  lines.push('');
}
writeFileSync(join(reportDir, 'summary.md'), lines.join('\n') + '\n');

log(`report written: ${relative(repoRoot, join(reportDir, 'parity-report.json')).replaceAll('\\', '/')}`);
log(`summary written: ${relative(repoRoot, join(reportDir, 'summary.md')).replaceAll('\\', '/')}`);
log(
  skipKosit
    ? 'done (Stampbench half only — run with Java for real parity numbers)'
    : `done: ${summary.agree}/${summary.comparable} agree (${summary.agreementRate === null ? 'n/a' : pct(summary.agreementRate)}), false-greens=${summary.koSitRejectWeAccept}, false-alarms=${summary.koSitAcceptWeReject}`
);

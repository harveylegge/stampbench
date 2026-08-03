#!/usr/bin/env node
/**
 * download.mjs — fetch the pinned official KoSIT tooling for the parity harness.
 *
 * Downloads (into tools/parity/vendor/, gitignored):
 *   - the KoSIT validator standalone JAR        (itplr-kosit/validator)
 *   - the XRechnung scenario configuration ZIP  (itplr-kosit/validator-configuration-xrechnung)
 *   - the official XRechnung test-suite ZIP     (itplr-kosit/xrechnung-testsuite)
 *
 * Exact versions/URLs come from VERSIONS.json — nothing here is "latest".
 * Downloaded sizes are checked byte-exact against the recorded release sizes;
 * a mismatch aborts (update VERSIONS.json deliberately, not by accident).
 *
 * Unzipping: tries `unzip`, falls back to `tar -xf` (bsdtar). GitHub Actions
 * ubuntu-latest ships `unzip`; Windows 10/11 ships bsdtar as `tar`. One of the
 * two must be on PATH. No npm dependencies, Node >= 20.
 *
 * Usage: node tools/parity/download.mjs [--force]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const vendorDir = join(here, 'vendor');
const downloadsDir = join(vendorDir, 'downloads');
const validatorDir = join(vendorDir, 'validator');
const configDir = join(vendorDir, 'config');
const testsuiteDir = join(vendorDir, 'testsuite');

const force = process.argv.includes('--force');
const versions = JSON.parse(readFileSync(join(here, 'VERSIONS.json'), 'utf8'));

function log(msg) {
  console.log(`[parity:download] ${msg}`);
}

function fail(msg) {
  console.error(`[parity:download] ERROR: ${msg}`);
  process.exit(1);
}

async function download(url, dest, expectedSize) {
  if (!force && existsSync(dest) && statSync(dest).size === expectedSize) {
    log(`cached   ${relative(here, dest)} (${expectedSize} bytes)`);
    return;
  }
  log(`fetching ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) fail(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== expectedSize) {
    fail(
      `size mismatch for ${url}: got ${buf.length} bytes, VERSIONS.json records ${expectedSize}. ` +
        `The release asset changed — re-verify and update VERSIONS.json deliberately.`
    );
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  log(`saved    ${relative(here, dest)} (${buf.length} bytes)`);
}

function extract(zipPath, destDir) {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  const attempts = [
    { cmd: 'unzip', args: ['-o', '-q', zipPath, '-d', destDir] },
    { cmd: 'tar', args: ['-xf', zipPath, '-C', destDir] },
  ];
  const errors = [];
  for (const { cmd, args } of attempts) {
    const r = spawnSync(cmd, args, { encoding: 'utf8' });
    if (!r.error && r.status === 0) {
      log(`unzipped ${relative(here, zipPath)} -> ${relative(here, destDir)} (via ${cmd})`);
      return;
    }
    errors.push(`${cmd}: ${r.error ? r.error.message : `exit ${r.status} ${r.stderr?.slice(0, 300) ?? ''}`}`);
  }
  fail(`could not extract ${zipPath}. Need 'unzip' or a zip-capable 'tar' (bsdtar) on PATH.\n${errors.join('\n')}`);
}

/** Recursively find files matching a predicate. Returns paths relative to root, POSIX-style. */
function findFiles(root, predicate, acc = [], base = root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) findFiles(full, predicate, acc, base);
    else if (predicate(full)) acc.push(relative(base, full).replaceAll('\\', '/'));
  }
  return acc;
}

async function main() {
  mkdirSync(downloadsDir, { recursive: true });

  // 1. Validator standalone JAR — no extraction needed.
  const jarPath = join(validatorDir, versions.validator.asset);
  await download(versions.validator.url, jarPath, versions.validator.sizeBytes);

  // 2. Scenario configuration ZIP.
  const configZip = join(downloadsDir, versions.configuration.asset);
  await download(versions.configuration.url, configZip, versions.configuration.sizeBytes);
  extract(configZip, configDir);

  // 3. Test-suite ZIP.
  const testsuiteZip = join(downloadsDir, versions.testsuite.asset);
  await download(versions.testsuite.url, testsuiteZip, versions.testsuite.sizeBytes);
  extract(testsuiteZip, testsuiteDir);

  // Verify expected content and record real locations for run.mjs.
  const scenarios = findFiles(configDir, (p) => p.endsWith('scenarios.xml'));
  if (scenarios.length !== 1) {
    fail(`expected exactly one scenarios.xml in ${configDir}, found ${scenarios.length}: ${scenarios.join(', ')}`);
  }
  const scenariosXml = join(configDir, scenarios[0]);
  // Repository path for -r is the directory containing scenarios.xml.
  const repositoryDir = dirname(scenariosXml);

  const instanceXmls = findFiles(testsuiteDir, (p) => p.endsWith('.xml'));
  if (instanceXmls.length < 50) {
    fail(`test-suite extraction looks wrong: only ${instanceXmls.length} XML files under ${testsuiteDir}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    jar: relative(here, jarPath).replaceAll('\\', '/'),
    scenariosXml: relative(here, scenariosXml).replaceAll('\\', '/'),
    repositoryDir: relative(here, repositoryDir).replaceAll('\\', '/'),
    testsuiteDir: relative(here, testsuiteDir).replaceAll('\\', '/'),
    testsuiteXmlCount: instanceXmls.length,
  };
  writeFileSync(join(vendorDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  log(`ok: jar=${manifest.jar}`);
  log(`ok: scenarios=${manifest.scenariosXml}`);
  log(`ok: testsuite has ${instanceXmls.length} XML files`);
  log(`manifest written to ${relative(here, join(vendorDir, 'manifest.json'))}`);
}

main().catch((e) => fail(e.stack ?? String(e)));

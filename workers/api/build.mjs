/**
 * Bundle the account worker to apps/web/out/_worker.js (Pages Advanced mode)
 * and write _routes.json.
 *
 * The worker fronts /api/* AND HTML page navigations (the latter so it can
 * record a privacy-preserving aggregate page-view count — see analytics.ts).
 * High-volume static assets — the hashed _next bundles, images and icons —
 * are EXCLUDED so they are served straight from Pages' asset store and never
 * cost a worker invocation. Page routes have no file extension, so `include:
 * ['/*']` minus the asset prefixes lands exactly the navigations we want to
 * count; anything an exclude misses still serves correctly, it just costs one
 * extra (cheap) worker call.
 *
 * Run AFTER apps/web/scripts/build-static.mjs (which recreates out/):
 *   node workers/api/build.mjs
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(root, 'apps', 'web', 'out');

if (!existsSync(outDir)) {
  throw new Error('apps/web/out does not exist — run the static build first.');
}

// esbuild strips types without checking them, so a type error here would ship
// silently and only surface as a runtime fault in production — on the session
// and billing paths, of all places. Typecheck first and refuse to bundle.
console.log('[worker] typechecking…');
// Run the compiler's own entry point under this Node rather than going through
// `npx`: no shell, so no platform-dependent quoting and no deprecation warning.
execFileSync(process.execPath, [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-p',
  join(here, 'tsconfig.json'),
  '--noEmit',
], { cwd: here, stdio: 'inherit' });

await build({
  entryPoints: [join(root, 'workers', 'api', 'src', 'index.ts')],
  outfile: join(outDir, '_worker.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  conditions: ['workerd', 'import'],
  // node:* stays external: the Anthropic SDK lazily imports node:fs/path for
  // credential-file auth we never trigger (we pass apiKey explicitly). The
  // Pages project runs with the nodejs_compat flag so the imports resolve.
  external: ['cloudflare:*', 'node:*'],
  minify: true,
  logLevel: 'info',
});

writeFileSync(
  join(outDir, '_routes.json'),
  JSON.stringify({
    version: 1,
    include: ['/*'],
    // Static assets that must bypass the worker. Cloudflare caps this at 100
    // rules; these cover essentially all asset request volume.
    exclude: [
      '/_next/*',
      '/brand/*',
      '/favicon.ico',
      '/icon.png',
      '/icon.svg',
      '/robots.txt',
      '/sitemap.xml',
      '/_headers',
    ],
  }) + '\n',
);

console.log('[worker] bundled to apps/web/out/_worker.js — worker fronts /api/* and page navigations');

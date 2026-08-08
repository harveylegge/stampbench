/**
 * Bundle the account worker to apps/web/out/_worker.js (Pages Advanced mode)
 * and write _routes.json so static assets bypass the worker entirely — only
 * /api/* invocations count against the Workers free tier.
 *
 * Run AFTER apps/web/scripts/build-static.mjs (which recreates out/):
 *   node workers/api/build.mjs
 */
import { build } from 'esbuild';
import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'apps', 'web', 'out');

if (!existsSync(outDir)) {
  throw new Error('apps/web/out does not exist — run the static build first.');
}

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
  JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }) + '\n',
);

console.log('[worker] bundled to apps/web/out/_worker.js with /api/* routing');

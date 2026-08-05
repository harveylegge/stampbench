/**
 * Build the credential-free static site for Cloudflare Pages.
 *
 *   node scripts/build-static.mjs
 *
 * Server-only routes (auth, admin, dashboard, API) are moved aside for the
 * duration of the build — `next export` requires every route to be static,
 * and these are exactly the parts of the app that stay dormant until the
 * hosted platform launches. They are restored afterwards no matter what.
 *
 * Output: apps/web/out — drag the folder into Cloudflare Pages (Direct
 * Upload), then add stampbench.com under Custom domains.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(webRoot, 'app');
const holding = join(webRoot, '.static-excluded');
const SERVER_ONLY = ['(auth)', 'admin', 'api', 'dashboard'];

const moved = [];
function exclude() {
  mkdirSync(holding, { recursive: true });
  for (const name of SERVER_ONLY) {
    const from = join(appDir, name);
    if (!existsSync(from)) continue;
    renameSync(from, join(holding, name));
    moved.push(name);
  }
  console.log(`[static] excluded server-only routes: ${moved.join(', ')}`);
}

function restore() {
  for (const name of moved.splice(0)) {
    renameSync(join(holding, name), join(appDir, name));
  }
  rmSync(holding, { recursive: true, force: true });
  console.log('[static] restored server-only routes');
}

/**
 * next.config's headers() is ignored by `next export`; Cloudflare Pages reads
 * a `_headers` file instead. Same policy, minus the parts a static site
 * cannot violate.
 */
const HEADERS = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'
`;

exclude();
try {
  rmSync(join(webRoot, 'out'), { recursive: true, force: true });
  execSync('npx next build', {
    cwd: webRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      STATIC_EXPORT: '1',
      NEXT_PUBLIC_STATIC_EXPORT: '1',
      NEXT_PUBLIC_APP_URL: 'https://stampbench.com',
    },
  });
  // With a custom distDir, next export writes the site into the distDir itself.
  renameSync(join(webRoot, '.next-static'), join(webRoot, 'out'));
  writeFileSync(join(webRoot, 'out', '_headers'), HEADERS);
  console.log('\n[static] done — upload the folder: apps/web/out');
} finally {
  restore();
}

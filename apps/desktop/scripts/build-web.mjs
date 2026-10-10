import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(desktopRoot, '..', '..');
const script = join(repoRoot, 'apps', 'web', 'scripts', 'build-static.mjs');

const result = spawnSync(process.execPath, [script], {
  cwd: repoRoot,
  env: { ...process.env, INCLUDE_DESKTOP_APP: '1' },
  stdio: 'inherit',
});

if (result.status !== 0) process.exit(result.status ?? 1);

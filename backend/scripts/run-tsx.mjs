import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Backend package root (parent of `scripts/`), regardless of shell cwd. */
const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function findTsxCli() {
  let dir = backendRoot;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Could not find tsx (install dependencies from the monorepo root).');
}

const tsxCli = findTsxCli();
const args = process.argv.slice(2);

const proc = spawn(process.execPath, [tsxCli, ...args], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
});

proc.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

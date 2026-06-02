/**
 * test-dead-flow.js
 *
 * Runs the TypeScript compiler with flow/reachability checks enabled to catch:
 * - Unreachable code (TS7027)
 * - Unused labels (TS7028)
 * - Missing returns on some code paths (TS7030)
 * - Switch fallthrough cases (TS7029)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let output = '';
let exitCode = 0;

try {
  execSync('npx tsc --noEmit --allowUnreachableCode false --allowUnusedLabels false --noImplicitReturns --noFallthroughCasesInSwitch', {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });
  console.log('✓ No reachability or control-flow dead code issues found.');
} catch (err) {
  output = (err.stdout || '') + (err.stderr || '');
  exitCode = 1;
}

if (exitCode !== 0) {
  const lines = output.split('\n');
  const relevant = lines.filter((l) => /TS7027|TS7028|TS7030|TS7029/.test(l));

  if (relevant.length === 0) {
    console.error('TypeScript compilation failed with unexpected errors:');
    console.error(output.slice(0, 2000));
    process.exit(1);
  }

  console.error(`✗ ${relevant.length} flow/reachability error(s) found:\n`);
  relevant.forEach((l) => console.error(' ', l.trim()));
  console.error('\nRun `npx tsc --noEmit --allowUnreachableCode false --allowUnusedLabels false --noImplicitReturns --noFallthroughCasesInSwitch` to see full output.');
  process.exit(1);
}

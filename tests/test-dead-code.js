/**
 * test-dead-code.js
 *
 * Runs the TypeScript compiler with --noUnusedLocals and --noUnusedParameters
 * to catch unused variables, imports, and parameters before they accumulate.
 *
 * Exits with code 1 if any TS6133 (unused variable) or TS6196 (unused param)
 * errors are found, printing each offending location.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let output = '';
let exitCode = 0;

try {
  execSync('npx tsc --noEmit --noUnusedLocals --noUnusedParameters', {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });
  console.log('✓ No unused variables or dead imports found.');
} catch (err) {
  output = (err.stdout || '') + (err.stderr || '');
  exitCode = 1;
}

if (exitCode !== 0) {
  // Filter to only unused-variable errors (TS6133, TS6196)
  const lines = output.split('\n');
  const relevant = lines.filter(l => /TS6133|TS6196/.test(l));

  if (relevant.length === 0) {
    // Compilation failed for other reasons — still surface the output
    console.error('TypeScript compilation failed with unexpected errors:');
    console.error(output.slice(0, 2000));
    process.exit(1);
  }

  console.error(`✗ ${relevant.length} unused variable / dead import error(s) found:\n`);
  relevant.forEach(l => console.error(' ', l.trim()));
  console.error('\nRun `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` to see full output.');
  process.exit(1);
}

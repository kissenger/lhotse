/**
 * test-dead-logic.js
 *
 * Uses ESLint rules focused on dead logical paths:
 * - no-unreachable
 * - no-constant-condition
 * - no-dupe-else-if
 * - @typescript-eslint/switch-exhaustiveness-check
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  execSync('npx eslint "src/**/*.{ts,js}" "tests/**/*.{ts,js}" --max-warnings=0', {
    cwd: rootDir,
    stdio: 'inherit',
    encoding: 'utf8'
  });
  console.log('✓ No dead logical path lint issues found.');
} catch {
  process.exit(1);
}

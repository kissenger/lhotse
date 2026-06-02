/**
 * test-dead-repo.js
 *
 * Uses Knip to detect project-level dead code signals such as:
 * - unused exports
 * - unused files
 * - unused dependencies
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  execSync('npx knip --config knip.json --include files,dependencies,unlisted,unresolved,catalog --no-config-hints', {
    cwd: rootDir,
    stdio: 'inherit',
    encoding: 'utf8'
  });
  console.log('✓ No repository-level unused files/dependencies issues found.');

  // Exports and types are reported separately (non-blocking) because this repo
  // intentionally keeps some framework/runtime-facing exports.
  execSync('npx knip --config knip.json --include exports,types,nsExports,nsTypes,enumMembers,duplicates --max-show-issues 60 --no-config-hints --no-exit-code', {
    cwd: rootDir,
    stdio: 'inherit',
    encoding: 'utf8'
  });
} catch {
  process.exit(1);
}

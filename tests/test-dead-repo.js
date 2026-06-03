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
import { existsSync } from 'fs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const knipConfigPath = path.join(rootDir, 'knip.json');
const knipConfigArg = existsSync(knipConfigPath) ? '--config knip.json ' : '';

try {
  execSync(`npx knip ${knipConfigArg}--include files,dependencies,unlisted,unresolved,catalog,exports,types,nsExports,nsTypes,enumMembers,duplicates --max-show-issues 80 --no-config-hints`, {
    cwd: rootDir,
    stdio: 'inherit',
    encoding: 'utf8'
  });
  console.log('✓ No repository-level dead code issues found (files, deps, exports, and types).');
} catch {
  process.exit(1);
}

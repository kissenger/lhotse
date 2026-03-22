import { spawn } from 'node:child_process';
import process from 'node:process';
import { config as loadEnv } from 'dotenv';

loadEnv();

const forwardedArgs = process.argv.slice(2);

if (process.env.MONGO_URI) {
  console.log('[run-e2e] MONGO_URI status: present');
} else {
  console.warn('[run-e2e] MONGO_URI status: missing');
  console.warn('[run-e2e] Nightly PayPal tests may fail if DB-backed endpoints are required.');
}

const playwrightArgs = ['playwright', 'test', ...forwardedArgs];
const command = `npx ${playwrightArgs.map((arg) => JSON.stringify(arg)).join(' ')}`;

const child = spawn(command, {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('[run-e2e] Failed to launch Playwright:', error.message);
  process.exit(1);
});

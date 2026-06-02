#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const TEST_STEPS = [
  { label: 'unit', command: 'npm', args: ['run', 'test'] },
  { label: 'seo', command: 'npm', args: ['run', 'test:seo'] },
  { label: 'shop-backend', command: 'npm', args: ['run', 'test:shop-backend'] },
  { label: 'dead-code', command: 'npm', args: ['run', 'test:dead-code'] },
  { label: 'dead-code-flow', command: 'npm', args: ['run', 'test:dead-code:flow'] },
  { label: 'dead-code-logic', command: 'npm', args: ['run', 'test:dead-code:logic'] },
  { label: 'dead-code-repo', command: 'npm', args: ['run', 'test:dead-code:repo'] },
  { label: 'dead-links', command: 'npm', args: ['run', 'test:dead-links'] },
  { label: 'lighthouse', command: 'npm', args: ['run', 'test:lighthouse'] },
  { label: 'ui-full', command: 'npm', args: ['run', 'test:ui'] },
  { label: 'ui-mongo-connectivity', command: 'npm', args: ['run', 'test:ui:mongo-connectivity'] },
  { label: 'ui-performance', command: 'npm', args: ['run', 'test:ui:performance'] },
  { label: 'paypal-ui', command: 'npm', args: ['run', 'test:paypal:ui'] },
  { label: 'paypal-sandbox', command: 'npm', args: ['run', 'test:paypal:sandbox'] },
];

function runStep(step) {
  const startedAt = Date.now();
  console.log(`\n--- Running ${step.label} (${step.command} ${step.args.join(' ')}) ---`);

  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  const durationMs = Date.now() - startedAt;
  const status = typeof result.status === 'number' ? result.status : 1;

  return {
    ...step,
    status,
    ok: status === 0,
    durationMs,
  };
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 100) / 10;
  return `${sec}s`;
}

function printSummary(results) {
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('\n========================================');
  console.log('TEST:ALL SUMMARY');
  console.log('========================================');
  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);
  console.log('');

  for (const result of results) {
    const icon = result.ok ? 'PASS' : 'FAIL';
    console.log(`- [${icon}] ${result.label} (exit ${result.status}, ${formatDuration(result.durationMs)})`);
  }

  if (failed.length > 0) {
    console.log('\n------------ FAILURE DETAILS ------------');
    for (const result of failed) {
      console.log(`* ${result.label}`);
      console.log(`  Command: ${result.command} ${result.args.join(' ')}`);
      console.log(`  Exit: ${result.status}`);
      console.log(`  Duration: ${formatDuration(result.durationMs)}`);
    }
    console.log('-----------------------------------------\n');
  }
}

function main() {
  const results = [];

  for (const step of TEST_STEPS) {
    results.push(runStep(step));
  }

  printSummary(results);

  const hasFailures = results.some((r) => !r.ok);
  process.exit(hasFailures ? 1 : 0);
}

main();

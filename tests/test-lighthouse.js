import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

function parseArgs(argv) {
  const options = {
    url: 'https://snorkelology.co.uk/',
    runs: 3,
    categories: ['performance'],
    outDir: path.join(process.cwd(), 'test-results', 'lighthouse'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--url=')) options.url = arg.slice('--url='.length);
    if (arg.startsWith('--runs=')) options.runs = Number(arg.slice('--runs='.length));
    if (arg.startsWith('--outDir=')) options.outDir = path.resolve(arg.slice('--outDir='.length));
  }

  if (!Number.isFinite(options.runs) || options.runs < 1) {
    throw new Error('`--runs` must be a positive integer.');
  }

  return options;
}

function profileConfig(profile) {
  if (profile === 'desktop') {
    return {
      extends: 'lighthouse:default',
      settings: {
        onlyCategories: ['performance'],
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
      },
    };
  }

  return {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: ['performance'],
      formFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 1.75,
        disabled: false,
      },
      throttlingMethod: 'simulate',
      throttling: {
        rttMs: 150,
        throughputKbps: 1638.4,
        cpuSlowdownMultiplier: 4,
        requestLatencyMs: 562.5,
        downloadThroughputKbps: 1474.56,
        uploadThroughputKbps: 675,
      },
    },
  };
}

function metricsFromLhr(lhr) {
  const byId = (id) => lhr.audits[id]?.numericValue ?? null;
  return {
    performanceScore: Math.round((lhr.categories.performance.score ?? 0) * 100),
    fcpMs: byId('first-contentful-paint'),
    lcpMs: byId('largest-contentful-paint'),
    speedIndexMs: byId('speed-index'),
    tbtMs: byId('total-blocking-time'),
    cls: byId('cumulative-layout-shift'),
    inpMs: byId('interaction-to-next-paint'),
    ttfbMs: byId('server-response-time'),
  };
}

function medianRun(results) {
  const sorted = [...results].sort((a, b) => a.metrics.performanceScore - b.metrics.performanceScore);
  return sorted[Math.floor(sorted.length / 2)];
}

function budgetFor(profile) {
  if (profile === 'desktop') {
    return {
      performanceScoreMin: 85,
      lcpMsMax: 2500,
      tbtMsMax: 200,
      clsMax: 0.1,
      ttfbMsMax: 1200,
    };
  }

  return {
    performanceScoreMin: 70,
    lcpMsMax: 4000,
    tbtMsMax: 350,
    clsMax: 0.1,
    ttfbMsMax: 1800,
  };
}

function evaluateBudgets(profile, metrics) {
  const budget = budgetFor(profile);
  const failures = [];

  if (metrics.performanceScore < budget.performanceScoreMin) {
    failures.push(`Performance score ${metrics.performanceScore} < ${budget.performanceScoreMin}`);
  }
  if (metrics.lcpMs != null && metrics.lcpMs > budget.lcpMsMax) {
    failures.push(`LCP ${Math.round(metrics.lcpMs)}ms > ${budget.lcpMsMax}ms`);
  }
  if (metrics.tbtMs != null && metrics.tbtMs > budget.tbtMsMax) {
    failures.push(`TBT ${Math.round(metrics.tbtMs)}ms > ${budget.tbtMsMax}ms`);
  }
  if (metrics.cls != null && metrics.cls > budget.clsMax) {
    failures.push(`CLS ${metrics.cls.toFixed(3)} > ${budget.clsMax}`);
  }
  if (metrics.ttfbMs != null && metrics.ttfbMs > budget.ttfbMsMax) {
    failures.push(`TTFB ${Math.round(metrics.ttfbMs)}ms > ${budget.ttfbMsMax}ms`);
  }

  return failures;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function runOneAudit({ url, profile, runIndex, outputDir }) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--incognito',
    ],
  });

  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: ['json', 'html'],
        logLevel: 'error',
      },
      profileConfig(profile)
    );

    if (!result?.lhr) {
      throw new Error(`Lighthouse returned no report for ${profile} run ${runIndex}`);
    }

    const filePrefix = `${profile}-run-${runIndex}`;
    const jsonPath = path.join(outputDir, `${filePrefix}.json`);
    const htmlPath = path.join(outputDir, `${filePrefix}.html`);

    const reports = Array.isArray(result.report) ? result.report : [result.report];
    const jsonReport = reports.find((r) => r.trim().startsWith('{'));
    const htmlReport = reports.find((r) => r.trim().toLowerCase().startsWith('<!doctype html'));

    if (jsonReport) fs.writeFileSync(jsonPath, jsonReport);
    if (htmlReport) fs.writeFileSync(htmlPath, htmlReport);

    return {
      profile,
      runIndex,
      jsonPath,
      htmlPath,
      metrics: metricsFromLhr(result.lhr),
      finalUrl: result.lhr.finalDisplayedUrl || result.lhr.finalUrl || url,
      fetchTime: result.lhr.fetchTime,
    };
  } finally {
    try {
      await chrome.kill();
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : undefined;
      if (code === 'EPERM') {
        console.warn('Warning: Chrome temp cleanup reported EPERM on shutdown. Continuing.');
      } else {
        throw error;
      }
    }
  }
}

function prettyMetrics(metrics) {
  return `score=${metrics.performanceScore}, LCP=${Math.round(metrics.lcpMs ?? 0)}ms, TBT=${Math.round(metrics.tbtMs ?? 0)}ms, CLS=${(metrics.cls ?? 0).toFixed(3)}, TTFB=${Math.round(metrics.ttfbMs ?? 0)}ms`;
}

async function runProfile({ url, runs, profile, outputDir }) {
  console.log(`\nRunning Lighthouse profile: ${profile} (${runs} runs)`);
  const results = [];

  for (let i = 1; i <= runs; i += 1) {
    process.stdout.write(`  - Run ${i}/${runs}... `);
    const result = await runOneAudit({ url, profile, runIndex: i, outputDir });
    results.push(result);
    console.log(`done (${prettyMetrics(result.metrics)})`);
  }

  const median = medianRun(results);
  const failures = evaluateBudgets(profile, median.metrics);

  return { profile, runs: results, median, failures };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runStamp = timestamp();
  const outputDir = path.join(options.outDir, runStamp);
  ensureDir(outputDir);

  console.log(`Lighthouse target URL: ${options.url}`);
  console.log(`Results directory: ${outputDir}`);

  const profiles = ['mobile', 'desktop'];
  const summaries = [];

  for (const profile of profiles) {
    summaries.push(await runProfile({
      url: options.url,
      runs: options.runs,
      profile,
      outputDir,
    }));
  }

  const summaryPath = path.join(outputDir, 'summary.json');
  writeJson(summaryPath, {
    url: options.url,
    runsPerProfile: options.runs,
    generatedAt: new Date().toISOString(),
    summaries: summaries.map((s) => ({
      profile: s.profile,
      median: s.median,
      failures: s.failures,
    })),
  });

  console.log('\nMedian run summary:');
  let hasFailures = false;
  for (const summary of summaries) {
    const { profile, median, failures } = summary;
    console.log(`- ${profile}: ${prettyMetrics(median.metrics)}`);
    if (failures.length) {
      hasFailures = true;
      for (const failure of failures) {
        console.log(`  FAIL: ${failure}`);
      }
    } else {
      console.log('  PASS: all budgets met');
    }
  }

  console.log(`\nSaved Lighthouse artifacts to: ${outputDir}`);
  console.log(`Saved summary JSON to: ${summaryPath}`);

  if (hasFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Lighthouse test runner failed:', error);
  process.exit(1);
});

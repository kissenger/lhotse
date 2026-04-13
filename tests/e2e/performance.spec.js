import { expect, test } from '@playwright/test';

test.describe('performance budgets', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/blog/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  });

  test('home page loads within performance budgets', async ({ page }) => {
    await page.goto('/home', { waitUntil: 'load' });

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find((e) => e.name === 'first-contentful-paint');
      return {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        load: Math.round(nav.loadEventEnd - nav.startTime),
        fcp: fcp ? Math.round(fcp.startTime) : null,
        transferSizeKB: Math.round(nav.transferSize / 1024),
      };
    });

    console.log('Performance metrics:', JSON.stringify(metrics, null, 2));

    // TTFB: server should respond quickly on localhost.
    expect(metrics.ttfb, `TTFB ${metrics.ttfb}ms exceeds budget`).toBeLessThan(2000);

    // FCP: first paint should happen within 3 seconds.
    if (metrics.fcp !== null) {
      expect(metrics.fcp, `FCP ${metrics.fcp}ms exceeds budget`).toBeLessThan(3000);
    }

    // DOM Content Loaded: interactive within 12 seconds (desktop Chromium on RPi is noticeably slower).
    expect(metrics.domContentLoaded, `DCL ${metrics.domContentLoaded}ms exceeds budget`).toBeLessThan(12_000);

    // Full load: everything within 15 seconds (webkit dev-server can be slow).
    expect(metrics.load, `Load ${metrics.load}ms exceeds budget`).toBeLessThan(15_000);

    // Document transfer size: HTML response under 200KB.
    expect(metrics.transferSizeKB, `Document transfer ${metrics.transferSizeKB}KB exceeds budget`).toBeLessThan(200);
  });

  test('initial JS bundle stays within size budget', async ({ page, baseURL }) => {
    // ng serve (port 4200) sends unminified bundles; this check only applies to built output.
    test.skip(baseURL.includes(':4200'), 'Skipped on dev server (ng serve sends unminified JS)');

    const resources = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.js') && response.status() === 200) {
        const headers = response.headers();
        const size = parseInt(headers['content-length'] || '0', 10);
        resources.push({ url: url.split('/').pop(), sizeKB: Math.round(size / 1024) });
      }
    });

    await page.goto('/home', { waitUntil: 'load' });

    const totalJsKB = resources.reduce((sum, r) => sum + r.sizeKB, 0);
    console.log(`Total initial JS: ${totalJsKB}KB across ${resources.length} files`);

    // Total JS budget: under 6MB transferred (dev-server bundles are unminified).
    expect(totalJsKB, `Total JS ${totalJsKB}KB exceeds budget`).toBeLessThan(6144);
  });
});

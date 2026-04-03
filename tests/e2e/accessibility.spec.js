import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/blog/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  });

  test('home page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/home');

    // Dismiss overlay so it doesn't interfere with the scan.
    const closeOverlay = page.locator('.about-book .close-icon');
    if (await closeOverlay.isVisible().catch(() => false)) {
      await closeOverlay.evaluate((el) => el.click()).catch(() => {});
    }

    // Wait for deferred sections to render.
    await page.waitForSelector('#blog', { timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('iframe') // Exclude third-party iframes (PayPal).
      .disableRules(['link-in-text-block']) // Design decision: links use colour only, no underline.
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      const summary = critical.map((v) =>
        `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))`
      ).join('\n');

      expect(critical, `Accessibility violations found:\n${summary}`).toHaveLength(0);
    }
  });

  test('404 page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await page.waitForSelector('app-page-not-found', { timeout: 10_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

    if (critical.length > 0) {
      const summary = critical.map((v) =>
        `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))`
      ).join('\n');

      expect(critical, `Accessibility violations found:\n${summary}`).toHaveLength(0);
    }
  });
});

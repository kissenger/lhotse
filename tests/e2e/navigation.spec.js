import { expect, test } from '@playwright/test';

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/article/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  });

  test('header contains all menu items', async ({ page }) => {
    await page.goto('/home');

    const expected = ['Home', 'Articles', 'Book', 'Shop', 'Map', 'FAQs'];
    for (const name of expected) {
      await expect(page.locator('.menu').getByText(name, { exact: true })).toBeVisible();
    }
  });

  test('clicking Articles navigates to the articles page', async ({ page }) => {

    await page.goto('/home');
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });

    // Dismiss overlay so it does not cover menu items.
    const closeOverlay = page.locator('.about-book .close-icon');
    if (await closeOverlay.isVisible().catch(() => false)) {
      await closeOverlay.evaluate((el) => el.click()).catch(() => {});
    }

    // Wait for home sections to render before interacting with header.
    await page.waitForSelector('section.home-preview-section', { timeout: 15_000 });

    const articlesMenuItem = page.locator('.menu li', { hasText: 'Articles' }).first();

    const itemAlreadyVisible = await articlesMenuItem.isVisible().catch(() => false);
    if (!itemAlreadyVisible) {
      const hamburger = page.locator('#hamburger');
      if (await hamburger.isVisible().catch(() => false)) {
        await hamburger.click({ force: true });
      }
    }

    await expect(articlesMenuItem).toBeVisible({ timeout: 10_000 });
    await articlesMenuItem.scrollIntoViewIfNeeded();
    await articlesMenuItem.click({ force: true });

    const navigatedAfterClick = /\/articles(?:\?.*)?$/.test(page.url());
    if (!navigatedAfterClick) {
      await articlesMenuItem.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      });
    }

    await expect(page).toHaveURL(/\/articles(?:\?.*)?$/);
  });

  test('/map route renders the standalone map page', async ({ page }) => {
    await page.route('**/api/sites/get-sites/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) })
    );

    await page.goto('/map');

    // Header should still be present on the standalone map page.
    await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });

    // The standalone route heading and map container should render.
    await expect(page.locator('.route-shell-header h1')).toHaveText('Snorkelling Map of Britain', { timeout: 15_000 });
    await expect(page.locator('app-map #map')).toBeVisible({ timeout: 30_000 });
  });

  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await expect(page.locator('app-page-not-found')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/couldn.*find that page/i)).toBeVisible();
  });

  test('404 page has a link back to home', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await expect(page.locator('app-page-not-found')).toBeVisible({ timeout: 10_000 });

    const homeLink = page.locator('app-page-not-found a[href="/"]');
    await expect(homeLink).toBeVisible();
    await homeLink.click();

    // Should end up on the home page.
    await expect(page).toHaveURL(/\/(home)?$/);
  });
});

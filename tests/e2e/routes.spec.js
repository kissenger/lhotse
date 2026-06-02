import { expect, test } from '@playwright/test';

const EMPTY_GEOJSON = {
  type: 'FeatureCollection',
  features: [],
};

test.describe('route smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/blog/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/sites/get-sites/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_GEOJSON) })
    );
  });

  test('/articles renders the articles page shell', async ({ page }) => {
    await page.goto('/articles');

    await expect(page.locator('.route-shell-header h1')).toHaveText('British Snorkelling Articles', { timeout: 15_000 });
    await expect(page.locator('app-blog')).toBeVisible();
  });

  test('/map renders the map page shell', async ({ page }) => {
    await page.goto('/map');

    await expect(page.locator('.route-shell-header h1')).toHaveText('Snorkelling Map of Britain', { timeout: 15_000 });
    await expect(page.locator('app-map #map')).toBeVisible({ timeout: 30_000 });
  });

  test('/shop renders the shop page shell', async ({ page }) => {
    await page.goto('/shop');

    await expect(page.locator('.route-shell-header h1')).toHaveText('Snorkelology Shop', { timeout: 15_000 });
    await expect(page.locator('.product-grid')).toBeVisible({ timeout: 15_000 });
  });

  test('/faq renders the FAQ page shell', async ({ page }) => {
    await page.goto('/faq');

    await expect(page.locator('.route-shell-header h1')).toHaveText('British Snorkelling FAQs', { timeout: 15_000 });
    await expect(page.locator('app-faq')).toBeVisible();
  });
});

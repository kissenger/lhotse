import { expect, test } from '@playwright/test';

const MOCK_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 0,
      geometry: { type: 'Point', coordinates: [-1.1, 50.8] },
      properties: {
        name: 'Test Snorkelling Site',
        featureType: 'Snorkelling Site',
        description: 'A test site for e2e.',
        categories: ['Rocky shore'],
        symbolSortOrder: 1,
        location: { locality: 'Testville', county: 'Testshire' },
        moreInfo: [],
      },
    },
  ],
};

test.describe('map section', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/blog/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/sites/get-sites/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GEOJSON) })
    );
  });

  test('home map teaser renders when scrolled into view', async ({ page }) => {
    await page.goto('/home');
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });

    // Dismiss overlay.
    const closeOverlay = page.locator('.about-book .close-icon');
    if (await closeOverlay.isVisible().catch(() => false)) {
      await closeOverlay.evaluate((el) => el.click()).catch(() => {});
    }

    // Scroll the map teaser section into the viewport.
    await page.locator('#snorkelling-map-of-britain').scrollIntoViewIfNeeded();

    // Home now renders a static teaser with CTA to /map rather than inline app-map.
    await expect(page.locator('#snorkelling-map-of-britain h2')).toHaveText('Snorkelling Map of Britain', { timeout: 15_000 });
    await expect(page.locator('#snorkelling-map-of-britain a[href="/map"]')).toBeVisible();
  });

  test('standalone /map page renders the map component', async ({ page }) => {
    await page.goto('/map');

    // Header must be visible (it wraps all routes).
    await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });

    // Standalone map route renders an h1 shell heading and app-map content.
    await expect(page.locator('.route-shell-header h1')).toHaveText('Snorkelling Map of Britain', { timeout: 15_000 });
    await expect(page.locator('app-map #map')).toBeVisible({ timeout: 30_000 });
  });
});

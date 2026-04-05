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

  test('map container renders when scrolled into view', async ({ page }) => {
    await page.goto('/home');
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });

    // Dismiss overlay.
    const closeOverlay = page.locator('.about-book .close-icon');
    if (await closeOverlay.isVisible().catch(() => false)) {
      await closeOverlay.evaluate((el) => el.click()).catch(() => {});
    }

    // Scroll the map section into the viewport to trigger @defer.
    await page.locator('#snorkelling-map-of-britain').scrollIntoViewIfNeeded();

    // The map component should render its heading.
    await expect(page.locator('app-map h2.section-heading')).toHaveText('Interactive Snorkelling Map of Britain', { timeout: 15_000 });

    // The Mapbox GL canvas should appear once the map initialises.
    await expect(page.locator('#map canvas.mapboxgl-canvas')).toBeVisible({ timeout: 30_000 });
  });

  test('standalone /map page renders the map component', async ({ page }) => {
    await page.goto('/map');

    // Header must be visible (it wraps all routes).
    await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });

    // Map heading should render.
    await expect(page.locator('app-map h2.section-heading')).toHaveText(
      'Interactive Snorkelling Map of Britain',
      { timeout: 15_000 }
    );

    // The Mapbox GL canvas should appear once the map initialises.
    await expect(page.locator('#map canvas.mapboxgl-canvas')).toBeVisible({ timeout: 30_000 });
  });
});

import { expect, test } from '@playwright/test';

test.describe('SEO meta tags and structured data', () => {
  test.describe('home page', () => {
    test('has correct title', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveTitle(/Snorkelology/);
    });

    test('has meta description', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute('content', /.+/);
    });

    test('has canonical link', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', /snorkelology\.co\.uk/);
    });

    test('has Open Graph tags', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\/.+/);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /snorkelology\.co\.uk/);
    });

    test('has Twitter card tags', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /^https?:\/\/.+/);
    });

    test('has Organization JSON-LD schema', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const org = schemas.find((s) => s['@type'] === 'Organization');
      expect(org, 'Organization schema should be present').toBeTruthy();
      expect(org.name).toBe('Snorkelology');
      expect(org.url).toContain('snorkelology.co.uk');
    });

    test('has FAQPage JSON-LD schema', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const faq = schemas.find((s) => s['@type'] === 'FAQPage');
      expect(faq, 'FAQPage schema should be present').toBeTruthy();
      expect(faq.mainEntity.length).toBeGreaterThan(0);
    });

    test('has Product JSON-LD schema', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const product = schemas.find((s) => s['@type'] === 'Product');
      expect(product, 'At least one Product schema should be present').toBeTruthy();
      expect(product.name).toBeTruthy();
      expect(product.offers).toBeTruthy();
    });

    test('has robots meta tag allowing indexing', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveAttribute('content', /index/);
    });
  });

  test.describe('404 page', () => {
    test('does not inject home page SEO tags', async ({ page }) => {
      await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' });

      // The 404 route should not get the home payload (no Organization schema).
      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const org = schemas.find((s) => s['@type'] === 'Organization');
      expect(org, '404 page should not have Organization schema').toBeFalsy();
    });
  });
});

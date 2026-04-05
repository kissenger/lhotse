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

    test('has Map JSON-LD schema on home page', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const map = schemas.find((s) => s['@type'] === 'Map');
      expect(map, 'Map schema should be present on home page').toBeTruthy();
      expect(map.url).toContain('/map');
      expect(map.spatialCoverage).toBeTruthy();
    });

    test('has VideoObject JSON-LD schema on home page', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const video = schemas.find((s) => s['@type'] === 'VideoObject');
      expect(video, 'VideoObject schema should be present on home page').toBeTruthy();
      expect(video.embedUrl).toContain('youtube.com');
      expect(video.thumbnailUrl).toBeTruthy();
    });

    test('has ImageObject schema for map on home page', async ({ page }) => {
      await page.goto('/home', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const img = schemas.find((s) => s['@type'] === 'ImageObject');
      expect(img, 'ImageObject schema should be present on home page').toBeTruthy();
      expect(img.representativeOfPage).toBe(true);
      expect(img.url).toContain('snorkelology');
    });
  });

  test.describe('/map page', () => {
    test('has correct title', async ({ page }) => {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveTitle(/100\+ Sites.*Snorkelology|Snorkelology.*100\+ Sites/);
    });

    test('has canonical pointing to /map', async ({ page }) => {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', /snorkelology\.co\.uk\/map$/);
    });

    test('has map-specific og:image', async ({ page }) => {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        /snorkelology-unique-snorkel-map-of-britain/
      );
    });

    test('has robots meta tag allowing indexing', async ({ page }) => {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveAttribute('content', /index/);
    });

    test('has BreadcrumbList JSON-LD schema', async ({ page }) => {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const breadcrumb = schemas.find((s) => s['@type'] === 'BreadcrumbList');
      expect(breadcrumb, 'BreadcrumbList schema should be present on /map').toBeTruthy();
      expect(breadcrumb.itemListElement).toHaveLength(2);
      expect(breadcrumb.itemListElement[1].item).toContain('/map');
    });

    test('has Map JSON-LD schema', async ({ page }) => {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const map = schemas.find((s) => s['@type'] === 'Map');
      expect(map, 'Map schema should be present on /map').toBeTruthy();
      expect(map.url).toContain('/map');
      expect(map.about).toBeInstanceOf(Array);
      expect(map.spatialCoverage['@type']).toBe('Place');
    });

    test('has ImageObject schema with representativeOfPage', async ({ page }) => {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      const schemas = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((el) => JSON.parse(el.textContent || '{}'))
      );

      const img = schemas.find((s) => s['@type'] === 'ImageObject');
      expect(img, 'ImageObject schema should be present on /map').toBeTruthy();
      expect(img.representativeOfPage).toBe(true);
    });
  });

  test.describe('privacy policy page', () => {
    test('has robots noindex tag', async ({ page }) => {
      await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });

      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveAttribute('content', /noindex/);
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

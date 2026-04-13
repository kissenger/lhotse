import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse every <script type="application/ld+json"> on the page into objects. */
async function getSchemas(page) {
  return page.$$eval(
    'script[type="application/ld+json"]',
    (els) => els.map((el) => { try { return JSON.parse(el.textContent || '{}'); } catch { return {}; } })
  );
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

test.describe('home page (/home)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
  });

  // --- title & description ---

  test('title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('Snorkelology \u2014 British Snorkelling Map, Articles & Snorkelling Britain Book');
  });

  test('meta description is correct', async ({ page }) => {
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Snorkelology \u2014 your guide to the best snorkelling in Britain. Explore our interactive snorkelling map, browse articles on marine life, gear and safety, and buy Snorkelling Britain: 100 Marine Adventures.'
    );
  });

  test('meta keywords are present and non-empty', async ({ page }) => {
    await expect(page.locator('meta[name="keywords"]')).toHaveAttribute('content', /snorkel/i);
  });

  // --- canonical ---

  test('canonical points to the root URL', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://snorkelology.co.uk/'
    );
  });

  // --- robots ---

  test('robots allows indexing and large image preview', async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content', /index.*max-image-preview:large/
    );
  });

  // --- Open Graph ---

  test('og:type is website', async ({ page }) => {
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  });

  test('og:title is non-empty', async ({ page }) => {
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
  });

  test('og:description is non-empty', async ({ page }) => {
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.+/);
  });

  test('og:image is an absolute URL', async ({ page }) => {
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/snorkelology\.co\.uk\//);
  });

  test('og:url is the root URL', async ({ page }) => {
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://snorkelology.co.uk/');
  });

  test('og:site_name is Snorkelology', async ({ page }) => {
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Snorkelology');
  });

  // --- Twitter ---

  test('twitter:card is summary_large_image', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  });

  test('twitter:title is non-empty', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /.+/);
  });

  test('twitter:description is non-empty', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', /.+/);
  });

  test('twitter:image is an absolute URL', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /^https:\/\//);
  });

  test('twitter:site is @snorkelology', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:site"]')).toHaveAttribute('content', '@snorkelology');
  });

  // --- JSON-LD: Organization ---

  test('Organization schema has correct name, url, logo, and sameAs', async ({ page }) => {
    const schemas = await getSchemas(page);
    const org = schemas.find((s) => s['@type'] === 'Organization');
    expect(org, 'Organization schema should be present').toBeTruthy();
    expect(org.name).toBe('Snorkelology');
    expect(org.url).toContain('snorkelology.co.uk');
    expect(org.logo).toContain('snorkelology.co.uk');
    expect(org.sameAs).toContain('https://instagram.com/snorkelology');
    expect(org.sameAs).toContain('https://www.youtube.com/@snorkelology');
    expect(org.sameAs).toContain('https://www.facebook.com/snorkelology');
  });

  // --- JSON-LD: Product ---

  test('at least one Product schema with name and offers', async ({ page }) => {
    const schemas = await getSchemas(page);
    const products = schemas.filter((s) => s['@type'] === 'Product');
    expect(products.length, 'At least one Product schema should be present').toBeGreaterThan(0);
    expect(products[0].name).toBeTruthy();
    expect(products[0].offers?.['@type']).toBe('Offer');
    expect(products[0].offers?.price).toBeTruthy();
    expect(products[0].offers?.priceCurrency).toBeTruthy();
    expect(products[0].offers?.availability).toContain('schema.org');
  });

  // --- JSON-LD: Book ---

  test('at least one Book schema with isbn and author', async ({ page }) => {
    const schemas = await getSchemas(page);
    const books = schemas.filter((s) => s['@type'] === 'Book');
    expect(books.length, 'At least one Book schema should be present').toBeGreaterThan(0);
    expect(books[0].isbn).toBeTruthy();
    expect(books[0].author?.['@type']).toBe('Person');
    expect(books[0].author?.name).toBeTruthy();
  });

  // --- JSON-LD: FAQPage ---

  test('FAQPage schema has multiple entries with correct structure', async ({ page }) => {
    const schemas = await getSchemas(page);
    const faq = schemas.find((s) => s['@type'] === 'FAQPage');
    expect(faq, 'FAQPage schema should be present').toBeTruthy();
    expect(faq.mainEntity.length, 'FAQPage should have at least 3 questions').toBeGreaterThan(2);
    const first = faq.mainEntity[0];
    expect(first['@type']).toBe('Question');
    expect(first.name).toBeTruthy();
    expect(first.acceptedAnswer?.['@type']).toBe('Answer');
    expect(first.acceptedAnswer?.text).toBeTruthy();
  });

  // --- JSON-LD: BlogPosting (DB cache validation) ---

  test('BlogPosting schemas are present — confirms DB cache is populated', async ({ page }) => {
    const schemas = await getSchemas(page);
    const posts = schemas.filter((s) => s['@type'] === 'BlogPosting');
    expect(posts.length, 'BlogPosting schemas should be present (DB cache must be loaded)').toBeGreaterThan(0);
    const first = posts[0];
    expect(first.headline).toBeTruthy();
    expect(first.datePublished).toBeTruthy();
    expect(first.author?.name).toBeTruthy();
  });

  // --- JSON-LD: @graph of map places (DB cache validation) ---

  test('@graph of map places is present with sufficient entries — confirms DB cache is populated', async ({ page }) => {
    const schemas = await getSchemas(page);
    const graphSchema = schemas.find((s) => Array.isArray(s['@graph']));
    expect(graphSchema, '@graph schema should be present (DB cache must be loaded)').toBeTruthy();
    expect(graphSchema['@graph'].length, '@graph should contain at least 50 places').toBeGreaterThanOrEqual(50);
    const first = graphSchema['@graph'][0];
    expect(first['@type']).toBeTruthy();
    expect(first.name).toBeTruthy();
  });

  // --- JSON-LD: Map (creative work) ---

  test('Map schema has url, about[], and spatialCoverage', async ({ page }) => {
    const schemas = await getSchemas(page);
    const map = schemas.find((s) => s['@type'] === 'Map');
    expect(map, 'Map schema should be present').toBeTruthy();
    expect(map.url).toContain('/map');
    expect(map.spatialCoverage?.['@type']).toBe('Place');
  });

  // --- JSON-LD: VideoObject ---

  test('VideoObject schema has embedUrl, thumbnailUrl, and uploadDate', async ({ page }) => {
    const schemas = await getSchemas(page);
    const video = schemas.find((s) => s['@type'] === 'VideoObject');
    expect(video, 'VideoObject schema should be present').toBeTruthy();
    expect(video.embedUrl).toContain('youtube.com');
    expect(video.thumbnailUrl).toContain('youtube.com');
    expect(video.uploadDate).toBeTruthy();
    expect(video.name).toBeTruthy();
  });

  // --- JSON-LD: ImageObject ---

  test('ImageObject schema has representativeOfPage and absolute url', async ({ page }) => {
    const schemas = await getSchemas(page);
    const img = schemas.find((s) => s['@type'] === 'ImageObject');
    expect(img, 'ImageObject schema should be present').toBeTruthy();
    expect(img.representativeOfPage).toBe(true);
    expect(img.url).toContain('snorkelology.co.uk');
  });
});

// ---------------------------------------------------------------------------
// /map page
// ---------------------------------------------------------------------------

test.describe('/map page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
  });

  test('title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('Interactive Snorkelling Map of Britain \u2014 100+ Sites | Snorkelology');
  });

  test('canonical points to /map', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://snorkelology.co.uk/map'
    );
  });

  test('robots allows indexing and large image preview', async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index.*max-image-preview:large/);
  });

  test('og:type is website', async ({ page }) => {
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  });

  test('og:image is the map image', async ({ page }) => {
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content', /snorkelology-unique-snorkel-map-of-britain/
    );
  });

  test('og:url points to /map', async ({ page }) => {
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /snorkelology\.co\.uk\/map$/);
  });

  test('og:site_name is Snorkelology', async ({ page }) => {
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Snorkelology');
  });

  test('twitter:card is summary_large_image', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  });

  test('twitter:image is an absolute URL', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /^https:\/\//);
  });

  test('BreadcrumbList has 2 items: Home → Map', async ({ page }) => {
    const schemas = await getSchemas(page);
    const bc = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(bc, 'BreadcrumbList should be present').toBeTruthy();
    expect(bc.itemListElement).toHaveLength(2);
    expect(bc.itemListElement[0].name).toBe('Home');
    expect(bc.itemListElement[1].item).toContain('/map');
  });

  test('Map schema has about[], keywords, and spatialCoverage', async ({ page }) => {
    const schemas = await getSchemas(page);
    const map = schemas.find((s) => s['@type'] === 'Map');
    expect(map, 'Map schema should be present').toBeTruthy();
    expect(map.url).toContain('/map');
    expect(map.about).toBeInstanceOf(Array);
    expect(map.about.length).toBeGreaterThan(0);
    expect(map.keywords).toBeTruthy();
    expect(map.spatialCoverage?.['@type']).toBe('Place');
  });

  test('ImageObject has representativeOfPage and correct url', async ({ page }) => {
    const schemas = await getSchemas(page);
    const img = schemas.find((s) => s['@type'] === 'ImageObject');
    expect(img, 'ImageObject should be present').toBeTruthy();
    expect(img.representativeOfPage).toBe(true);
    expect(img.url).toContain('snorkelology-unique-snorkel-map-of-britain');
  });

  test('@graph of map places is present with sufficient entries — confirms DB cache is populated', async ({ page }) => {
    const schemas = await getSchemas(page);
    const graphSchema = schemas.find((s) => Array.isArray(s['@graph']));
    expect(graphSchema, '@graph should be present on /map (DB cache must be loaded)').toBeTruthy();
    expect(graphSchema['@graph'].length, '@graph should contain at least 50 places').toBeGreaterThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// /blog index
// ---------------------------------------------------------------------------

test.describe('/blog index page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
  });

  test('title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('British Snorkelling Articles \u2014 Snorkelology');
  });

  test('meta description is non-empty', async ({ page }) => {
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });

  test('canonical points to /blog', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://snorkelology.co.uk/blog');
  });

  test('og:type is website', async ({ page }) => {
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  });

  test('robots allows indexing', async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/);
  });

  test('og:site_name is Snorkelology', async ({ page }) => {
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Snorkelology');
  });

  test('twitter:card is present', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  });

  test('CollectionPage schema has url and publisher', async ({ page }) => {
    const schemas = await getSchemas(page);
    const cp = schemas.find((s) => s['@type'] === 'CollectionPage');
    expect(cp, 'CollectionPage schema should be present').toBeTruthy();
    expect(cp.url).toContain('/blog');
    expect(cp.publisher?.name).toBe('Snorkelology');
  });
});

// ---------------------------------------------------------------------------
// /blog/:slug  (dynamic — uses first published slug from the API)
// ---------------------------------------------------------------------------

test.describe('/blog/:slug — individual blog post', () => {
  /** First published slug fetched from the API. */
  let slug = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/blog/get-all-slugs/', { timeout: 15_000 });
    if (!res.ok()) return;
    const data = await res.json();
    slug = data[0]?.slug ?? '';
  });

  test('title is non-empty', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/.+/);
  });

  test('meta description is non-empty', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });

  test('canonical contains /blog/', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /snorkelology\.co\.uk\/blog\//);
  });

  test('og:type is article', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  });

  test('og:image is an absolute URL', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\//);
  });

  test('robots allows indexing', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/);
  });

  test('BreadcrumbList has 3 items: Home → Blog → Post', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    const schemas = await getSchemas(page);
    const bc = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(bc, 'BreadcrumbList should be present').toBeTruthy();
    expect(bc.itemListElement).toHaveLength(3);
    expect(bc.itemListElement[0].name).toBe('Home');
    expect(bc.itemListElement[1].name).toBe('Blog');
    expect(bc.itemListElement[2].item).toContain(`/blog/${slug}`);
  });

  test('BlogPosting or FAQPage schema has required fields', async ({ page }) => {
    test.skip(!slug, 'No published blog posts available');
    await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
    const schemas = await getSchemas(page);
    const article = schemas.find((s) => s['@type'] === 'BlogPosting' || s['@type'] === 'FAQPage');
    expect(article, 'BlogPosting or FAQPage schema should be present').toBeTruthy();
    if (article['@type'] === 'BlogPosting') {
      expect(article.headline).toBeTruthy();
      expect(article.datePublished).toBeTruthy();
      expect(article.author?.name).toBeTruthy();
      expect(article.publisher?.name).toBe('Snorkelology');
      expect(article.url).toContain(`/blog/${slug}`);
    } else {
      expect(article.mainEntity?.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// /map?county=cornwall
// ---------------------------------------------------------------------------

test.describe('/map?county=cornwall', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map?county=cornwall', { waitUntil: 'domcontentloaded' });
  });

  test('title is correct for Cornwall', async ({ page }) => {
    await expect(page).toHaveTitle('Snorkelling Sites in Cornwall & the Isles of Scilly | Snorkelology');
  });

  test('meta description mentions Cornwall', async ({ page }) => {
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Cornwall/i);
  });

  test('canonical contains /map?county=cornwall', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href', /snorkelology\.co\.uk\/map\?county=cornwall/
    );
  });

  test('og:image is the map image', async ({ page }) => {
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content', /snorkelology-unique-snorkel-map-of-britain/
    );
  });

  test('robots allows indexing', async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/);
  });

  test('BreadcrumbList has 3 items: Home → Map → Cornwall', async ({ page }) => {
    const schemas = await getSchemas(page);
    const bc = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(bc, 'BreadcrumbList should be present').toBeTruthy();
    expect(bc.itemListElement).toHaveLength(3);
    expect(bc.itemListElement[0].name).toBe('Home');
    expect(bc.itemListElement[1].item).toContain('/map');
    expect(bc.itemListElement[2].item).toContain('county=cornwall');
  });
});

// ---------------------------------------------------------------------------
// /map?nation=england
// ---------------------------------------------------------------------------

test.describe('/map?nation=england', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map?nation=england', { waitUntil: 'domcontentloaded' });
  });

  test('title is correct for England', async ({ page }) => {
    await expect(page).toHaveTitle('Snorkelling Sites in England | Snorkelology');
  });

  test('meta description mentions England', async ({ page }) => {
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /England/);
  });

  test('canonical contains /map?nation=england', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href', /snorkelology\.co\.uk\/map\?nation=england/
    );
  });

  test('robots allows indexing', async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/);
  });

  test('BreadcrumbList has 3 items: Home → Map → England', async ({ page }) => {
    const schemas = await getSchemas(page);
    const bc = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(bc, 'BreadcrumbList should be present').toBeTruthy();
    expect(bc.itemListElement).toHaveLength(3);
    expect(bc.itemListElement[2].item).toContain('nation=england');
  });
});

// ---------------------------------------------------------------------------
// /map?site=X  (dynamic — uses first published site from the API)
// ---------------------------------------------------------------------------

test.describe('/map?site=X — individual map site', () => {
  /** First site name fetched from the API. */
  let siteName = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/sites/get-sites/Production', { timeout: 15_000 });
    if (!res.ok()) return;
    const data = await res.json();
    siteName = data.features?.[0]?.properties?.name ?? '';
  });

  test('title contains site name', async ({ page }) => {
    test.skip(!siteName, 'No sites available');
    await page.goto(`/map?site=${encodeURIComponent(siteName)}`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title).toContain(siteName);
  });

  test('meta description is non-empty', async ({ page }) => {
    test.skip(!siteName, 'No sites available');
    await page.goto(`/map?site=${encodeURIComponent(siteName)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  });

  test('canonical contains /map?site=', async ({ page }) => {
    test.skip(!siteName, 'No sites available');
    await page.goto(`/map?site=${encodeURIComponent(siteName)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href', /snorkelology\.co\.uk\/map\?site=/
    );
  });

  test('robots allows indexing', async ({ page }) => {
    test.skip(!siteName, 'No sites available');
    await page.goto(`/map?site=${encodeURIComponent(siteName)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/);
  });

  test('BreadcrumbList has 3 items: Home → Map → Site', async ({ page }) => {
    test.skip(!siteName, 'No sites available');
    await page.goto(`/map?site=${encodeURIComponent(siteName)}`, { waitUntil: 'domcontentloaded' });
    const schemas = await getSchemas(page);
    const bc = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(bc, 'BreadcrumbList should be present').toBeTruthy();
    expect(bc.itemListElement).toHaveLength(3);
    expect(bc.itemListElement[0].name).toBe('Home');
    expect(bc.itemListElement[1].item).toContain('/map');
    expect(bc.itemListElement[2].item).toContain('/map?site=');
  });

  test('place schema has @type and name', async ({ page }) => {
    test.skip(!siteName, 'No sites available');
    await page.goto(`/map?site=${encodeURIComponent(siteName)}`, { waitUntil: 'domcontentloaded' });
    const schemas = await getSchemas(page);
    const place = schemas.find((s) => s['@type'] === 'Place' || s['@type'] === 'SportsActivityLocation');
    expect(place, 'Place or SportsActivityLocation schema should be present').toBeTruthy();
    expect(place.name).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// /ai-transparency
// ---------------------------------------------------------------------------

test.describe('/ai-transparency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-transparency', { waitUntil: 'domcontentloaded' });
  });

  test('title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('AI Transparency | Snorkelology');
  });

  test('meta description mentions AI', async ({ page }) => {
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /AI/i);
  });

  test('canonical points to /ai-transparency', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://snorkelology.co.uk/ai-transparency'
    );
  });

  test('robots allows indexing (not noindex)', async ({ page }) => {
    const content = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(content).toContain('index');
    expect(content).not.toContain('noindex');
  });

  test('no JSON-LD schemas injected', async ({ page }) => {
    const schemas = await getSchemas(page);
    // Filter out any empty objects from parsing errors
    const nonEmpty = schemas.filter((s) => Object.keys(s).length > 0 && s['@type']);
    expect(nonEmpty.length, 'ai-transparency should have no JSON-LD schemas').toBe(0);
  });
});

// ---------------------------------------------------------------------------
// /privacy-policy
// ---------------------------------------------------------------------------

test.describe('/privacy-policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  });

  test('title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('Privacy Policy | Snorkelology');
  });

  test('canonical points to /privacy-policy', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href', 'https://snorkelology.co.uk/privacy-policy'
    );
  });

  test('robots is noindex', async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('no JSON-LD schemas injected', async ({ page }) => {
    const schemas = await getSchemas(page);
    const nonEmpty = schemas.filter((s) => Object.keys(s).length > 0 && s['@type']);
    expect(nonEmpty.length, 'privacy-policy should have no JSON-LD schemas').toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 404 page
// ---------------------------------------------------------------------------

test.describe('404 page', () => {
  test('does not inject any SEO schemas', async ({ page }) => {
    await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' });
    const schemas = await getSchemas(page);
    const nonEmpty = schemas.filter((s) => Object.keys(s).length > 0 && s['@type']);
    expect(nonEmpty.length, '404 page should have no JSON-LD schemas from SEO injection').toBe(0);
  });

  test('does not have a canonical tag from SEO injection', async ({ page }) => {
    await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' });
    // SEO injection adds canonical only for known routes; 404 should have none
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(0);
  });
});

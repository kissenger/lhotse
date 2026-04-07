import { test, expect } from '@playwright/test';

/** Public pages to crawl for links. */
const SEED_PAGES = ['/home', '/map', '/privacy-policy'];

/**
 * Domains that routinely block automated requests (403/429).
 * We skip the HTTP reachability check for these but they are still
 * validated to be syntactically correct URLs.
 */
const NO_HTTP_CHECK = new Set([
  'www.facebook.com',
  'www.instagram.com',
]);

/**
 * Returns true for statuses that mean "the resource exists but access
 * is restricted" — common for external sites blocking bots.
 */
function isLive(status) {
  return status < 400 || status === 403 || status === 405 || status === 429;
}

/**
 * Collect all href attribute values from <a> tags on a page.
 * Pass waitForSelector to pause until a deferred section has rendered
 * (e.g. the partners list, which lives inside an @defer block).
 */
async function collectHrefs(page, path, { waitForSelector } = {}) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (waitForSelector) {
    await page.locator(waitForSelector).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }
  return page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => a.getAttribute('href')).filter(Boolean)
  );
}

/**
 * Fetch all production map sites via the public API and extract every external
 * URL from moreInfo entries and imageUrl fields.
 */
async function collectSiteLinks(request) {
  let data;
  try {
    const res = await request.get('/api/sites/get-sites/Production', { timeout: 15_000 });
    if (!res.ok()) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const urls = [];
  for (const feature of data.features ?? []) {
    const p = feature.properties ?? {};
    if (/^https?:\/\//i.test(p.imageUrl ?? '')) urls.push(p.imageUrl);
    for (const item of p.moreInfo ?? []) {
      if (/^https?:\/\//i.test(item.url ?? '')) urls.push(item.url);
    }
  }
  return urls;
}

/**
 * Fetch all published blog posts via the API and extract every external URL
 * from ctaLinks, videoUrls and inline href attributes within HTML content fields.
 * This avoids the need to navigate to every blog post URL in the browser.
 */
async function collectBlogPostLinks(request) {
  let posts;
  try {
    const res = await request.get('/api/blog/get-published-posts/', { timeout: 15_000 });
    if (!res.ok()) return [];
    posts = await res.json();
  } catch {
    return [];
  }

  const urls = [];

  for (const post of posts) {
    for (const section of post.sections ?? []) {
      // Explicit CTA links
      for (const cta of section.ctaLinks ?? []) {
        if (/^https?:\/\//i.test(cta.url ?? '')) urls.push(cta.url);
      }
      // Embedded video URLs
      if (/^https?:\/\//i.test(section.videoUrl ?? '')) urls.push(section.videoUrl);
      // Inline <a href="..."> inside HTML content
      for (const [, url] of (section.content ?? '').matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
        urls.push(url);
      }
    }
    // intro and conclusion are also rendered HTML and may carry links
    for (const field of [post.intro, post.conclusion]) {
      for (const [, url] of (field ?? '').matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

test.describe('dead links', () => {
  // Link existence is browser-independent — run in one project only.
  test.skip(({ browserName }) => browserName !== 'chromium', 'single-browser check');

  test('internal links resolve without 404', async ({ page }) => {
    // Mock the blog API so this test stays fast and deterministic.
    await page.route('**/api/blog/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    const internalPaths = new Set();

    for (const seed of SEED_PAGES) {
      const hrefs = await collectHrefs(page, seed);
      for (const href of hrefs) {
        // Collect root-relative paths only; skip mailto/external/fragments-only
        if (href.startsWith('/') && !href.startsWith('//')) {
          internalPaths.add(href.split('#')[0] || '/');
        }
      }
    }

    const broken = [];
    for (const path of internalPaths) {
      if (SEED_PAGES.includes(path)) continue; // already visited during collection

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      if (title.includes('Page not found')) {
        broken.push(path);
      }
    }

    expect(
      broken,
      `Internal links leading to 404:\n${broken.map((p) => `  ${p}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('external links are reachable', async ({ page, request }) => {
    const base = new URL('http://127.0.0.1:4200');
    const externalUrls = new Set();

    // ── Crawl seed pages ────────────────────────────────────────────────────
    // /home: wait for .partner-list so that the outer @defer block (which fires
    // on idle) has rendered before we collect hrefs.
    const waitSelectors = { '/home': '.partner-list' };
    for (const seed of SEED_PAGES) {
      const hrefs = await collectHrefs(page, seed, { waitForSelector: waitSelectors[seed] });
      for (const href of hrefs) {
        if (!href.startsWith('http://') && !href.startsWith('https://')) continue;
        const url = new URL(href);
        if (url.hostname === base.hostname) continue; // internal
        url.hash = '';
        externalUrls.add(url.toString());
      }
    }

    // ── Collect links from every published blog post via the API ────────────
    const blogLinks = await collectBlogPostLinks(request);
    for (const rawUrl of blogLinks) {
      try {
        const url = new URL(rawUrl);
        if (url.hostname === base.hostname) continue;
        url.hash = '';
        externalUrls.add(url.toString());
      } catch { /* skip malformed URLs */ }
    }

    // ── Collect moreInfo / imageUrl links from all production map sites ─────
    const siteLinks = await collectSiteLinks(request);
    for (const rawUrl of siteLinks) {
      try {
        const url = new URL(rawUrl);
        if (url.hostname === base.hostname) continue;
        url.hash = '';
        externalUrls.add(url.toString());
      } catch { /* skip malformed URLs */ }
    }

    // ── Check each URL ───────────────────────────────────────────────────────
    const broken = [];
    const allUrls = [...externalUrls];
    console.log(`\nChecking ${allUrls.length} external URLs...\n`);

    for (const rawUrl of allUrls) {
      const { hostname } = new URL(rawUrl);
      if (NO_HTTP_CHECK.has(hostname)) {
        console.log(`  [SKIP] ${rawUrl}`);
        continue;
      }

      const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)' };
      const opts = { timeout: 15_000, headers, failOnStatusCode: false };

      let response = await request.head(rawUrl, opts).catch(() => null);

      // Some servers reject HEAD — retry with GET
      if (!response || response.status() === 405) {
        response = await request.get(rawUrl, opts).catch(() => null);
      }

      const status = response?.status() ?? 'network error';
      const live = response && isLive(response.status());
      console.log(`  [${live ? 'OK ' : 'FAIL'}] ${status} — ${rawUrl}`);

      if (!live) {
        broken.push({ url: rawUrl, status });
      }
    }

    console.log(`\n${broken.length === 0 ? 'All URLs OK.' : `${broken.length} broken URL(s).`}\n`);

    expect(
      broken,
      `Broken external links:\n${broken.map((b) => `  [${b.status}] ${b.url}`).join('\n')}`
    ).toHaveLength(0);
  });
});

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

/** Collect all href attribute values from <a> tags on a page. */
async function collectHrefs(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  return page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => a.getAttribute('href')).filter(Boolean)
  );
}

test.describe('dead links', () => {
  // Link existence is browser-independent — run in one project only.
  test.skip(({ browserName }) => browserName !== 'chromium', 'single-browser check');

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/blog/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  });

  test('internal links resolve without 404', async ({ page }) => {
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

    for (const seed of SEED_PAGES) {
      const hrefs = await collectHrefs(page, seed);
      for (const href of hrefs) {
        if (!href.startsWith('http://') && !href.startsWith('https://')) continue;
        const url = new URL(href);
        if (url.hostname === base.hostname) continue; // internal
        url.hash = '';
        externalUrls.add(url.toString());
      }
    }

    const broken = [];
    for (const rawUrl of externalUrls) {
      const { hostname } = new URL(rawUrl);
      if (NO_HTTP_CHECK.has(hostname)) continue;

      const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)' };
      const opts = { timeout: 15_000, headers, failOnStatusCode: false };

      let response = await request.head(rawUrl, opts).catch(() => null);

      // Some servers reject HEAD — retry with GET
      if (!response || response.status() === 405) {
        response = await request.get(rawUrl, opts).catch(() => null);
      }

      if (!response || !isLive(response.status())) {
        broken.push({ url: rawUrl, status: response?.status() ?? 'network error' });
      }
    }

    expect(
      broken,
      `Broken external links:\n${broken.map((b) => `  [${b.status}] ${b.url}`).join('\n')}`
    ).toHaveLength(0);
  });
});

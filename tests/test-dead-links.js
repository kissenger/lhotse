/**
 * test-dead-links.js
 *
 * Checks all internal paths and external URLs reachable from the site for dead links.
 * Uses native fetch — no browser or Playwright required.
 *
 * Usage:
 *   node ./tests/test-dead-links.js                        # localhost by default
 *   node ./tests/test-dead-links.js http://localhost:4000  # dev SSR server
 *   TEST_APP_BASE_URL=http://localhost:4000 node ./tests/test-dead-links.js
 *   TEST_APP_BASE_URL=https://snorkelology.co.uk node ./tests/test-dead-links.js # production override
 */
import { glob, readFile } from 'node:fs/promises';
import { resolveBaseUrl } from './shared/resolve-base-url.js';

const BASE_URL = resolveBaseUrl({ cliArg: process.argv[2], envKeys: ['TEST_APP_BASE_URL'] });
const BASE_HOSTNAME = new URL(BASE_URL).hostname;

const SEED_PATHS = ['/', '/home', '/map', '/privacy-policy'];
const UA = 'Mozilla/5.0 (compatible; LinkChecker/1.0)';
const TIMEOUT_MS = 15_000;

/**
 * Domains that routinely block automated requests (403/429).
 * Skip the HTTP check for these — they're validated by being in the DB.
 */
const NO_CHECK_DOMAINS = new Set([
  'www.facebook.com', 'www.instagram.com',
  'www.youtube.com', 'youtube.com', 'youtu.be',
]);

function isLive(status) {
  return (status >= 200 && status < 400) || status === 403 || status === 405 || status === 429;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error(`Timeout after ${TIMEOUT_MS}ms`), { isTimeout: true });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function probeUrl(url, method = 'HEAD', redirect = 'follow') {
  try {
    const res = await fetchWithTimeout(url, {
      method,
      headers: { 'User-Agent': UA },
      redirect,
    });
    return {
      status: res.status,
      location: res.headers.get('location') ?? undefined,
      contentType: res.headers.get('content-type') ?? '',
    };
  } catch {
    return { status: 'error' };
  }
}

function extractAnchorHrefs(html) {
  // Only extract hrefs from <a> tags — ignore <link rel="preconnect"> etc.
  const hrefs = [];
  for (const [, href] of html.matchAll(/<a\b[^>]+href="([^"]+)"/gi)) {
    hrefs.push(href);
  }
  return hrefs;
}

function canonicalizeInternalPath(path) {
  const [pathname, query = ''] = path.split('?');
  const querySuffix = query ? `?${query}` : '';

  if (pathname === '/article') {
    return `/articles${querySuffix}`;
  }

  if (pathname.startsWith('/article/section/')) {
    return `${pathname.replace('/article/section/', '/articles/section/')}${querySuffix}`;
  }

  if (pathname.startsWith('/article/')) {
    return `${pathname.replace('/article/', '/articles/')}${querySuffix}`;
  }

  return `${pathname}${querySuffix}`;
}

function classifyHref(href, internalPaths, externalUrls) {
  let normalized = href.split('#')[0];
  if (!normalized) return;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const u = new URL(normalized);
      if (u.hostname === BASE_HOSTNAME) {
        const internalPath = canonicalizeInternalPath((`${u.pathname}${u.search}`.replace(/\/$/, '') || '/'));
        if (!internalPath.startsWith('/cdn-cgi/')) {
          internalPaths.add(internalPath);
        }
      } else {
        u.hash = '';
        externalUrls.add(u.toString());
      }
    } catch {
      // skip malformed URL
    }
    return;
  }

  if (normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.startsWith('/cdn-cgi/')) {
    internalPaths.add(canonicalizeInternalPath(normalized));
  }
}

// ── Collectors ────────────────────────────────────────────────────────────────

async function crawlSeedPages() {
  const internalPaths = new Set();
  const externalUrls = new Set();

  for (const seed of SEED_PATHS) {
    let html;
    try {
      const res = await fetchWithTimeout(`${BASE_URL}${seed}`, { headers: { 'User-Agent': UA } });
      html = await res.text();
    } catch {
      console.log(`  [WARN] Could not fetch seed page: ${seed}`);
      continue;
    }

    for (const href of extractAnchorHrefs(html)) {
      classifyHref(href, internalPaths, externalUrls);
    }
  }

  return { internalPaths, externalUrls };
}

async function collectSitemapPaths() {
  const internalPaths = new Set();

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/sitemap.xml`, {
      headers: { 'User-Agent': UA }
    });
    if (!res.ok) return internalPaths;

    const xml = await res.text();
    for (const [, rawLoc] of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      try {
        const loc = rawLoc.trim();
        const url = new URL(loc);
        if (url.hostname !== BASE_HOSTNAME) continue;
        const path = canonicalizeInternalPath((`${url.pathname}${url.search}`.replace(/\/$/, '') || '/'));
        if (!path.startsWith('/cdn-cgi/')) {
          internalPaths.add(path);
        }
      } catch {
        // skip malformed sitemap URL entries
      }
    }
  } catch {
    console.log('  [WARN] Could not fetch sitemap.xml');
  }

  return internalPaths;
}

async function collectTemplateAnchorLinks() {
  const internalPaths = new Set();
  const externalUrls = new Set();
  const htmlFiles = glob('src/app/**/*.html', { withFileTypes: false });

  for await (const filePath of htmlFiles) {
    try {
      const html = await readFile(filePath, 'utf8');
      for (const href of extractAnchorHrefs(html)) {
        classifyHref(href, internalPaths, externalUrls);
      }
    } catch {
      // ignore unreadable template files
    }
  }

  return { internalPaths, externalUrls };
}

async function collectArticleLinks() {
  const internalPaths = new Set();
  const externalUrls = new Set();
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/article/get-published-posts/`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { internalPaths, externalUrls };
    const posts = await res.json();

    for (const post of posts) {
      if (post.slug) internalPaths.add(`/articles/${post.slug}`);
      if (post.articleSection) internalPaths.add(`/articles/section/${post.articleSection}`);

      for (const section of post.sections ?? []) {
        for (const cta of section.ctaLinks ?? []) {
          classifyHref(cta.url ?? '', internalPaths, externalUrls);
        }
        classifyHref(section.videoUrl ?? '', internalPaths, externalUrls);
        for (const [, u] of (section.content ?? '').matchAll(/href="([^"]+)"/gi)) {
          classifyHref(u, internalPaths, externalUrls);
        }
      }
      for (const field of [post.intro, post.conclusion]) {
        for (const [, u] of (field ?? '').matchAll(/href="([^"]+)"/gi)) {
          classifyHref(u, internalPaths, externalUrls);
        }
      }
    }
  } catch {
    console.log('  [WARN] Could not fetch article posts');
  }
  return { internalPaths, externalUrls };
}

async function collectSiteLinks() {
  const internalPaths = new Set();
  const externalUrls = new Set();
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/sites/get-sites/Production`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { internalPaths, externalUrls };
    const data = await res.json();

    for (const feature of data.features ?? []) {
      const p = feature.properties ?? {};
      classifyHref(p.imageUrl ?? '', internalPaths, externalUrls);
      for (const item of p.moreInfo ?? []) {
        classifyHref(item.url ?? '', internalPaths, externalUrls);
      }
    }
  } catch {
    console.log('  [WARN] Could not fetch map sites');
  }
  return { internalPaths, externalUrls };
}

async function crawlInternalPagesForLinks(seedPaths) {
  const internalPaths = new Set();
  const externalUrls = new Set();
  const visited = new Set();
  const queue = [...seedPaths];

  while (queue.length > 0) {
    const path = queue.shift();
    if (!path || visited.has(path)) continue;
    visited.add(path);

    try {
      const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
        headers: { 'User-Agent': UA },
        redirect: 'follow',
      });

      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) continue;

      const html = await res.text();
      for (const href of extractAnchorHrefs(html)) {
        const before = internalPaths.size;
        classifyHref(href, internalPaths, externalUrls);
        if (internalPaths.size > before) {
          const normalized = href.split('#')[0];
          try {
            let discoveredPath = '';
            if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
              const u = new URL(normalized);
              if (u.hostname === BASE_HOSTNAME) {
                discoveredPath = canonicalizeInternalPath((`${u.pathname}${u.search}`.replace(/\/$/, '') || '/'));
              }
            } else if (normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.startsWith('/cdn-cgi/')) {
              discoveredPath = canonicalizeInternalPath(normalized);
            }

            if (discoveredPath && !visited.has(discoveredPath)) {
              queue.push(discoveredPath);
            }
          } catch {
            // ignore malformed discovered links
          }
        }
      }
    } catch {
      // ignore pages that fail fetch here; they are validated in internal path checks
    }
  }

  return { internalPaths, externalUrls };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Checking links against ${BASE_URL}\n`);

  const internalPaths = new Set(SEED_PATHS);
  const externalUrls = new Set();

  console.log('Crawling seed pages ...');
  const seedLinks = await crawlSeedPages();
  for (const path of seedLinks.internalPaths) internalPaths.add(path);
  for (const url of seedLinks.externalUrls) externalUrls.add(url);

  console.log('Reading sitemap routes ...');
  const sitemapPaths = await collectSitemapPaths();
  for (const path of sitemapPaths) internalPaths.add(path);

  console.log('Scanning template links ...');
  const templateLinks = await collectTemplateAnchorLinks();
  for (const path of templateLinks.internalPaths) internalPaths.add(path);
  for (const url of templateLinks.externalUrls) externalUrls.add(url);

  console.log('Recursively crawling internal pages ...');
  const recursiveLinks = await crawlInternalPagesForLinks(internalPaths);
  for (const path of recursiveLinks.internalPaths) internalPaths.add(path);
  for (const url of recursiveLinks.externalUrls) externalUrls.add(url);

  console.log('Fetching article post links ...');
  const articleLinks = await collectArticleLinks();
  for (const path of articleLinks.internalPaths) internalPaths.add(path);
  for (const url of articleLinks.externalUrls) externalUrls.add(url);

  console.log('Fetching map site links ...');
  const siteLinks = await collectSiteLinks();
  for (const path of siteLinks.internalPaths) internalPaths.add(path);
  for (const url of siteLinks.externalUrls) externalUrls.add(url);

  const intBroken = [];
  const extBroken = [];

  // ── Internal paths ─────────────────────────────────────────────────────────
  console.log(`\nChecking ${internalPaths.size} internal paths ...`);
  for (const path of internalPaths) {
    let probe = await probeUrl(`${BASE_URL}${path}`, 'HEAD', 'manual');
    // Some routes only implement redirect logic on GET handlers.
    if (probe.status === 405 || probe.status === 404 || probe.status === 'error') {
      probe = await probeUrl(`${BASE_URL}${path}`, 'GET', 'manual');
    }

    const status = probe.status;
    if (typeof status === 'number' && status >= 300 && status < 400) {
      intBroken.push({ path, status, reason: `redirects to ${probe.location ?? 'unknown location'}` });
      console.log(`  [FAIL] ${status} — ${path} (redirect)`);
    } else if (status === 404 || status === 'error') {
      intBroken.push({ path, status, reason: 'not found or request failed' });
      console.log(`  [FAIL] ${status} — ${path}`);
    } else if (typeof status === 'number' && status >= 200 && status < 300) {
      console.log(`  [OK ] ${status} — ${path}`);
    } else {
      intBroken.push({ path, status, reason: 'non-success internal response' });
      console.log(`  [FAIL] ${status} — ${path}`);
    }
  }

  // ── External URLs ──────────────────────────────────────────────────────────
  console.log(`\nChecking ${externalUrls.size} external URLs ...`);
  for (const url of externalUrls) {
    const { hostname } = new URL(url);
    if (NO_CHECK_DOMAINS.has(hostname)) {
      console.log(`  [SKIP] ${url}`);
      continue;
    }

    let probe = await probeUrl(url, 'HEAD', 'follow');
    if (!isLive(probe.status)) {
      probe = await probeUrl(url, 'GET', 'follow');
    }
    const status = probe.status;

    if (isLive(status)) {
      console.log(`  [OK ] ${status} — ${url}`);
    } else {
      extBroken.push({ url, status });
      console.log(`  [FAIL] ${status} — ${url}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');

  if (intBroken.length === 0 && extBroken.length === 0) {
    console.log(`All links OK (${internalPaths.size} internal, ${externalUrls.size} external).`);
    process.exit(0);
  }

  if (intBroken.length > 0) {
    console.error('Broken internal links:');
    for (const { path, status, reason } of intBroken) {
      console.error(`  [${status}] ${path} (${reason})`);
    }
  }
  if (extBroken.length > 0) {
    console.error('Broken external links:');
    for (const { url, status } of extBroken) console.error(`  [${status}] ${url}`);
  }

  console.error(`\n${intBroken.length} broken internal + ${extBroken.length} broken external link(s).`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(2);
});

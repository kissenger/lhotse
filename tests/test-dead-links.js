/**
 * test-dead-links.js
 *
 * Checks all internal paths and external URLs reachable from the site for dead links.
 * Uses native fetch — no browser or Playwright required.
 *
 * Usage:
 *   node ./tests/test-dead-links.js                        # prod (default)
 *   node ./tests/test-dead-links.js http://localhost:4000  # dev SSR server
 *   BASE_URL=http://localhost:4000 node ./tests/test-dead-links.js
 */

const BASE_URL = (process.argv[2] || process.env.BASE_URL || 'https://snorkelology.co.uk').replace(/\/$/, '');
const BASE_HOSTNAME = new URL(BASE_URL).hostname;
import { readFile } from 'node:fs/promises';
import { globSync } from 'glob';

const SEED_PATHS = ['/home', '/map', '/privacy-policy'];
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

async function getStatus(url, method = 'HEAD') {
  try {
    const res = await fetchWithTimeout(url, {
      method,
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    return res.status;
  } catch {
    return 'error';
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

function classifyHref(href, internalPaths, externalUrls) {
  let normalized = href.split('#')[0];
  if (!normalized) return;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const u = new URL(normalized);
      if (u.hostname === BASE_HOSTNAME) {
        const internalPath = `${u.pathname}${u.search}`.replace(/\/$/, '') || '/';
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
    internalPaths.add(normalized);
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

async function collectTemplateAnchorLinks() {
  const internalPaths = new Set();
  const externalUrls = new Set();
  const htmlFiles = globSync('src/app/**/*.html', { nodir: true });

  for (const filePath of htmlFiles) {
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

async function collectBlogLinks() {
  const urls = new Set();
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/blog/get-published-posts/`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return urls;
    const posts = await res.json();

    for (const post of posts) {
      for (const section of post.sections ?? []) {
        for (const cta of section.ctaLinks ?? []) {
          if (/^https?:\/\//i.test(cta.url ?? '')) urls.add(cta.url);
        }
        if (/^https?:\/\//i.test(section.videoUrl ?? '')) urls.add(section.videoUrl);
        for (const [, u] of (section.content ?? '').matchAll(/href="(https?:\/\/[^"]+)"/gi)) urls.add(u);
      }
      for (const field of [post.intro, post.conclusion]) {
        for (const [, u] of (field ?? '').matchAll(/href="(https?:\/\/[^"]+)"/gi)) urls.add(u);
      }
    }
  } catch {
    console.log('  [WARN] Could not fetch blog posts');
  }
  return urls;
}

async function collectSiteLinks() {
  const urls = new Set();
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/sites/get-sites/Production`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return urls;
    const data = await res.json();

    for (const feature of data.features ?? []) {
      const p = feature.properties ?? {};
      if (/^https?:\/\//i.test(p.imageUrl ?? '')) urls.add(p.imageUrl);
      for (const item of p.moreInfo ?? []) {
        if (/^https?:\/\//i.test(item.url ?? '')) urls.add(item.url);
      }
    }
  } catch {
    console.log('  [WARN] Could not fetch map sites');
  }
  return urls;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Checking links against ${BASE_URL}\n`);

  console.log('Crawling seed pages ...');
  const { internalPaths, externalUrls } = await crawlSeedPages();

  console.log('Scanning template links ...');
  const templateLinks = await collectTemplateAnchorLinks();
  for (const path of templateLinks.internalPaths) internalPaths.add(path);
  for (const url of templateLinks.externalUrls) externalUrls.add(url);

  console.log('Fetching blog post links ...');
  const blogLinks = await collectBlogLinks();

  console.log('Fetching map site links ...');
  const siteLinks = await collectSiteLinks();

  // Merge all external URLs, filtering own domain
  for (const raw of [...blogLinks, ...siteLinks]) {
    classifyHref(raw, internalPaths, externalUrls);
  }

  // Remove seed pages — confirmed live during crawl
  for (const seed of SEED_PATHS) internalPaths.delete(seed);

  const intBroken = [];
  const extBroken = [];

  // ── Internal paths ─────────────────────────────────────────────────────────
  console.log(`\nChecking ${internalPaths.size} internal paths ...`);
  for (const path of internalPaths) {
    let status = await getStatus(`${BASE_URL}${path}`, 'HEAD');
    if (status === 404 || status === 405 || status === 'error') {
      status = await getStatus(`${BASE_URL}${path}`, 'GET');
    }

    if (status === 404 || status === 'error') {
      intBroken.push({ path, status });
      console.log(`  [FAIL] ${status} — ${path}`);
    } else {
      console.log(`  [OK ] ${status} — ${path}`);
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

    let status = await getStatus(url, 'HEAD');
    if (status === 405 || status === 'error') {
      status = await getStatus(url, 'GET');
    }

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
    for (const { path, status } of intBroken) console.error(`  [${status}] ${path}`);
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

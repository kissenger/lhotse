import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveBaseUrl } from './shared/resolve-base-url.js';

const BASE_URL = resolveBaseUrl({ cliArg: process.argv[2], envKeys: ['TEST_APP_BASE_URL'] });
const ROOT = process.cwd();
const TIMEOUT_MS = 20_000;

const STATIC_FILES = [
  { name: 'prod', file: path.join(ROOT, 'src', 'config', 'prod', 'index.html'), expectNoindex: false },
  { name: 'beta', file: path.join(ROOT, 'src', 'config', 'beta', 'index.html'), expectNoindex: true },
];

const CORE_RUNTIME_ROUTES = ['/', '/home', '/articles', '/map', '/privacy-policy', '/affiliate-disclosure', '/ai-transparency'];
const LIGHTWEIGHT_POLICY_PAGES = new Set(['/privacy-policy', '/affiliate-disclosure', '/ai-transparency']);
const DESCRIPTION_OPTIONAL_PAGES = new Set(['/privacy-policy']);
const ARTICLE_API_CANDIDATES = [
  '/api/article/get-sitemap-entries/',
  '/api/article/get-published-posts/',
  '/api/article/get-all-slugs/',
];

const failures = [];
const warnings = [];

function fail(scope, message) {
  failures.push({ scope, message });
  console.error(`[FAIL] ${scope}: ${message}`);
}

function warn(scope, message) {
  warnings.push({ scope, message });
  console.warn(`[WARN] ${scope}: ${message}`);
}

function ok(scope, message) {
  console.log(`[OK ] ${scope}: ${message}`);
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail('static', `cannot read ${filePath}: ${error.message}`);
    return null;
  }
}

function extractAttr(tag, attrName) {
  const regex = new RegExp(`${attrName}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return tag.match(regex)?.[2]?.trim() ?? null;
}

function hasMetaTag(html, attrs) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  return tags.some((tag) => {
    for (const [key, expected] of Object.entries(attrs)) {
      const actual = extractAttr(tag, key);
      if (!actual || actual.toLowerCase() !== expected.toLowerCase()) return false;
    }
    return true;
  });
}

function hasCanonicalTag(html) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  return links.some((tag) => (extractAttr(tag, 'rel') || '').toLowerCase() === 'canonical');
}

function findMetaContent(html, attrs) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of tags) {
    let matches = true;
    for (const [key, expected] of Object.entries(attrs)) {
      const actual = extractAttr(tag, key);
      if (!actual || actual.toLowerCase() !== expected.toLowerCase()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return extractAttr(tag, 'content');
    }
  }
  return null;
}

function findCanonicalHref(html) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of links) {
    const rel = extractAttr(tag, 'rel');
    if (rel?.toLowerCase() === 'canonical') {
      return extractAttr(tag, 'href');
    }
  }
  return null;
}

function findTitle(html) {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || null;
}

function parseJsonLd(html, scope) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const parsed = [];

  for (const script of scripts) {
    const raw = (script[1] || '').trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) parsed.push(...data);
      else parsed.push(data);
    } catch (error) {
      fail(scope, `invalid JSON-LD: ${error.message}`);
    }
  }

  return parsed;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: init.redirect ?? 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

function assertPresent(scope, label, value) {
  if (!value || !String(value).trim()) {
    fail(scope, `missing ${label}`);
    return false;
  }
  ok(scope, `${label} present`);
  return true;
}

function hasSchemaType(schemas, typeName) {
  return schemas.some((schema) => schema?.['@type'] === typeName);
}

function normalizePathname(pathname) {
  if (!pathname) return '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function checkStaticTemplates() {
  console.log('\n== Static SEO template checks ==');

  for (const entry of STATIC_FILES) {
    const html = readFileSafe(entry.file);
    if (!html) continue;

    const scope = `static:${entry.name}`;
    if (!hasCanonicalTag(html)) fail(scope, 'missing canonical tag'); else ok(scope, 'canonical tag present');
    if (!hasMetaTag(html, { property: 'og:type' })) fail(scope, 'missing og:type tag'); else ok(scope, 'og:type tag present');
    if (!hasMetaTag(html, { property: 'og:title' })) fail(scope, 'missing og:title tag'); else ok(scope, 'og:title tag present');
    if (!hasMetaTag(html, { property: 'og:description' })) fail(scope, 'missing og:description tag'); else ok(scope, 'og:description tag present');
    if (!hasMetaTag(html, { name: 'twitter:card' })) fail(scope, 'missing twitter:card tag'); else ok(scope, 'twitter:card tag present');

    const robots = findMetaContent(html, { name: 'robots' }) || '';
    if (entry.expectNoindex) {
      if (!/noindex/i.test(robots)) fail(scope, 'beta should include robots noindex');
      else ok(scope, 'beta noindex present');
    }
  }
}

async function discoverDynamicRoutes() {
  const routes = new Set(CORE_RUNTIME_ROUTES);
  let articleApiAvailable = false;

  function addArticleRoutesFromItems(items) {
    for (const item of items ?? []) {
      if (item?.slug) routes.add(`/articles/${item.slug}`);
      if (item?.articleSection) routes.add(`/articles/section/${item.articleSection}`);
    }
  }

  for (const candidate of ARTICLE_API_CANDIDATES) {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}${candidate}`);
      if (!response.ok) {
        warn('runtime:discover', `${candidate} returned ${response.status}`);
        continue;
      }

      const items = await response.json();
      articleApiAvailable = true;
      addArticleRoutesFromItems(Array.isArray(items) ? items.slice(0, 5) : []);
      ok('runtime:discover', `discovered ${Math.min(Array.isArray(items) ? items.length : 0, 5)} article routes via ${candidate}`);
      break;
    } catch (error) {
      warn('runtime:discover', `unable to fetch article routes from ${candidate}: ${error.message}`);
    }
  }

  if (!articleApiAvailable) {
    warn('runtime:discover', 'no public article API route responded successfully');
  }

  try {
    const sitesRes = await fetchWithTimeout(`${BASE_URL}/api/sites/get-provider-names/`);
    if (!sitesRes.ok) {
      warn('runtime:discover', `/api/sites/get-provider-names/ returned ${sitesRes.status}`);
    } else {
      const rows = await sitesRes.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.path) {
        routes.add(rows[0].path);
        ok('runtime:discover', `discovered map route ${rows[0].path}`);
      }
    }
  } catch (error) {
    warn('runtime:discover', `unable to fetch map routes: ${error.message}`);
  }

  return { routes: [...routes], articleApiAvailable };
}

async function checkBlogRedirects() {
  console.log('\n== Blog redirect checks ==');

  const blogPaths = ['/blog', '/blog/section/snorkelling-gear', '/blog/the-british-snorkelling-wetsuit-guide-how-to-stay-warm-in-uk-waters'];

  for (const blogPath of blogPaths) {
    const scope = `redirect:${blogPath}`;
    try {
      const res = await fetchWithTimeout(`${BASE_URL}${blogPath}`, { redirect: 'manual' });
      const location = res.headers.get('location') || '';
      if (res.status < 300 || res.status > 399) {
        fail(scope, `expected 3xx redirect, got ${res.status}`);
        continue;
      }
      if (!location.startsWith('/articles')) {
        fail(scope, `expected redirect location to /articles..., got ${location || '<empty>'}`);
        continue;
      }
      ok(scope, `${res.status} -> ${location}`);
    } catch (error) {
      fail(scope, `request failed: ${error.message}`);
    }
  }
}

function checkRuntimeSeoForRoute(route, finalUrl, html) {
  const scope = `runtime:${route}`;
  const finalPath = normalizePathname(new URL(finalUrl, BASE_URL).pathname);
  const isLightweightPolicyPage = LIGHTWEIGHT_POLICY_PAGES.has(finalPath);
  const isDescriptionOptionalPage = DESCRIPTION_OPTIONAL_PAGES.has(finalPath);

  assertPresent(scope, 'title', findTitle(html));
  if (isDescriptionOptionalPage) {
    ok(scope, 'meta description optional for this page');
  } else {
    assertPresent(scope, 'meta description', findMetaContent(html, { name: 'description' }));
  }
  assertPresent(scope, 'canonical', findCanonicalHref(html));
  assertPresent(scope, 'og:type', findMetaContent(html, { property: 'og:type' }));
  assertPresent(scope, 'og:title', findMetaContent(html, { property: 'og:title' }));
  if (isDescriptionOptionalPage) {
    ok(scope, 'og:description optional for this page');
  } else {
    assertPresent(scope, 'og:description', findMetaContent(html, { property: 'og:description' }));
  }
  assertPresent(scope, 'og:url', findMetaContent(html, { property: 'og:url' }));
  if (isLightweightPolicyPage) {
    ok(scope, 'og:image optional for policy page');
  } else {
    assertPresent(scope, 'og:image', findMetaContent(html, { property: 'og:image' }));
  }
  assertPresent(scope, 'twitter:card', findMetaContent(html, { name: 'twitter:card' }));
  assertPresent(scope, 'twitter:title', findMetaContent(html, { name: 'twitter:title' }));
  if (isDescriptionOptionalPage) {
    ok(scope, 'twitter:description optional for this page');
  } else {
    assertPresent(scope, 'twitter:description', findMetaContent(html, { name: 'twitter:description' }));
  }
  if (isLightweightPolicyPage) {
    ok(scope, 'twitter:image optional for policy page');
  } else {
    assertPresent(scope, 'twitter:image', findMetaContent(html, { name: 'twitter:image' }));
  }
  assertPresent(scope, 'robots', findMetaContent(html, { name: 'robots' }));

  const canonicalHref = findCanonicalHref(html);
  const ogUrl = findMetaContent(html, { property: 'og:url' });

  try {
    if (canonicalHref && ogUrl) {
      const canonicalPath = normalizePathname(new URL(canonicalHref, BASE_URL).pathname);
      const ogPath = normalizePathname(new URL(ogUrl, BASE_URL).pathname);
      const finalPathForCompare = normalizePathname(new URL(finalUrl, BASE_URL).pathname);

      if (canonicalPath !== ogPath) {
        fail(scope, `canonical and og:url paths differ (${canonicalPath} vs ${ogPath})`);
      } else {
        ok(scope, `canonical and og:url agree (${canonicalPath})`);
      }

      const canonicalMatchesHomeAlias = finalPathForCompare === '/home' && canonicalPath === '/';
      if (canonicalPath !== finalPathForCompare && !canonicalMatchesHomeAlias) {
        fail(scope, `canonical path ${canonicalPath} differs from final path ${finalPathForCompare}`);
      }
    }
  } catch (error) {
    fail(scope, `cannot compare canonical/og urls: ${error.message}`);
  }

  const schemas = parseJsonLd(html, scope);
  if (schemas.length === 0 && !isLightweightPolicyPage) {
    fail(scope, 'missing JSON-LD schema blocks');
    return;
  }
  if (schemas.length === 0 && isLightweightPolicyPage) {
    ok(scope, 'JSON-LD optional for policy page');
    return;
  }
  ok(scope, `JSON-LD blocks: ${schemas.length}`);

  if (finalPath === '/' || finalPath === '/home') {
    if (!hasSchemaType(schemas, 'Organization')) fail(scope, 'home should include Organization schema');
    if (!hasSchemaType(schemas, 'Map')) fail(scope, 'home should include Map schema');
  }

  if (finalPath === '/articles') {
    if (!hasSchemaType(schemas, 'CollectionPage')) warn(scope, 'articles page missing CollectionPage schema');
  }

  if (finalPath.startsWith('/articles/section/')) {
    if (!hasSchemaType(schemas, 'CollectionPage')) fail(scope, 'section page should include CollectionPage schema');
    if (!hasSchemaType(schemas, 'BreadcrumbList')) fail(scope, 'section page should include BreadcrumbList schema');
  }

  if (finalPath.startsWith('/articles/') && !finalPath.startsWith('/articles/section/')) {
    const hasArticlePosting = hasSchemaType(schemas, 'ArticlePosting');
    const hasFaqPage = hasSchemaType(schemas, 'FAQPage');
    if (!hasArticlePosting && !hasFaqPage) {
      fail(scope, 'article page should include ArticlePosting or FAQPage schema');
    }
    if (!hasSchemaType(schemas, 'BreadcrumbList')) fail(scope, 'article page should include BreadcrumbList schema');
  }
}

async function checkRuntimePages(routes) {
  console.log(`\n== Runtime SEO checks (${BASE_URL}) ==`);

  for (const route of routes) {
    const scope = `runtime:${route}`;
    try {
      const res = await fetchWithTimeout(`${BASE_URL}${route}`);
      if (!res.ok) {
        fail(scope, `HTTP ${res.status}`);
        continue;
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('text/html')) {
        fail(scope, `expected text/html response, got ${contentType || '<missing>'}`);
        continue;
      }

      const html = await res.text();
      checkRuntimeSeoForRoute(route, res.url || `${BASE_URL}${route}`, html);
    } catch (error) {
      fail(scope, `request failed: ${error.message}`);
    }
  }
}

async function checkArticleAndMapRouteFamilies() {
  const { routes, articleApiAvailable } = await discoverDynamicRoutes();

  if (!articleApiAvailable) {
    warn('runtime:discover', 'article routes were not discovered from a public API response');
  }

  await checkRuntimePages(routes);
}

function printSummaryAndExit() {
  console.log('\n========================================');
  console.log('SEO CHECK SUMMARY');
  console.log('========================================');
  console.log(`Failures: ${failures.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (failures.length > 0) {
    console.error('\nFailure details:');
    for (const item of failures) {
      console.error(`- [${item.scope}] ${item.message}`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\nWarning details:');
    for (const item of warnings) {
      console.warn(`- [${item.scope}] ${item.message}`);
    }
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

async function main() {
  console.log(`Running comprehensive SEO checks against ${BASE_URL}`);
  checkStaticTemplates();
  await checkBlogRedirects();
  await checkArticleAndMapRouteFamilies();
  printSummaryAndExit();
}

main().catch((error) => {
  console.error('Unexpected SEO test error:', error);
  process.exit(2);
});

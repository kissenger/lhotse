import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AngularNodeAppEngine, isMainModule, createNodeRequestHandler, writeResponseToNodeResponse } from '@angular/ssr/node';
import mongoose from 'mongoose';
import FeatureModel from '../schema/feature';
import { shop } from './server-shop';
import { auth, requireAdmin, verifyToken } from './server-auth';
import { article, getPublishedPostBySlugForSeo, getPublishedPostsForSeo } from './server-article';
import { getPlacesForSeo, getPlacesForSeoWithRouteMeta, map } from './server-map';
import { organisations } from './server-organisations';
import { injectSeoPayloadIntoHtml, type SeoMetaTag, type SeoPayload } from './server-seo-injection';
import { shopItems } from './environments/environment._shopItems';
import { faqItems } from './app/shared/faq-data';
import { buildYouTubeEmbedUrl, extractYouTubeVideoId } from './app/shared/utils/youtube-url';
import { MAP_COUNTRY_DISPLAY_NAMES, buildMapPath, getCountrySlugFromRegion, getCountyDisplayName, getCountySlugFromLocation, getCountyMatchSlugs, normaliseCountrySegment, normaliseCountySegment, normaliseSiteSegment, toTitleCase } from './app/shared/map-paths';
import 'dotenv/config';

const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
const SKIP_SEO_DB_LOOKUPS = process.env['SKIP_SEO_DB_LOOKUPS'] === 'true';
const app = express();
app.use(compression());
const angularApp = new AngularNodeAppEngine();
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
let mongooseConnectPromise: Promise<void> | null = null;

interface SeoCache {
  places: any[];
  routePlaces: any[];
  posts: any[];
}
let seoCache: SeoCache | null = null;
let seoCacheRefreshPromise: Promise<void> | null = null;

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function getQuerySuffix(query: Record<string, unknown>): string {
  const passthrough = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      passthrough.set(key, value);
    }
  }
  const queryString = passthrough.toString();
  return queryString ? `?${queryString}` : '';
}

function sendNotFound(res: express.Response): void {
  res.status(404).send('Not found');
}

function shouldForceNotFoundStatusFromHtml(html: string): boolean {
  return html.includes('data-page-not-found="true"');
}

function getSectionSlugFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  return decodeURIComponent(segments[2] ?? '').trim();
}

function getSimplePageSeoPayload(
  title: string,
  description: string,
  canonicalPath: string,
  robots: 'index,follow' | 'noindex,follow' = 'noindex,follow'
): SeoPayload {
  return {
    title,
    description,
    keywords: '',
    canonicalPath,
    ogType: 'website',
    ogImage: '',
    twitterImage: '',
    schemas: [],
    metaTags: [{ key: 'name', keyValue: 'robots', content: robots }]
  };
}

function scheduleSeoCacheRefresh(): void {
  if (seoCacheRefreshPromise) return;
  seoCacheRefreshPromise = refreshSeoCache().finally(() => {
    seoCacheRefreshPromise = null;
  });
}

app.use((req, res, next) => {
  if (req.hostname === 'admin.snorkelology.co.uk') {
    res.locals['isAdminSubdomainRequest'] = true;
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    // Prevent proxy/edge caches from storing admin responses.
    res.setHeader('Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Accel-Expires', '0');
    if (req.path === '/') {
      res.redirect(302, '/dashboard');
      return;
    }
  }
  next();
});

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  const cspPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "script-src 'self' 'sha256-VM2mZqyEQZoLzoTrp5EigFvzQ0+f1wSeBuoOn95WHCg=' 'sha256-ICzSh2fqG0SYHzXcol4npA+pjBArzVpEJoARJfwTY2M=' https://api.mapbox.com https://www.paypal.com https://www.sandbox.paypal.com https://static.cloudflareinsights.com",
    "script-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://api.mapbox.com",
    "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://www.paypal.com https://www.sandbox.paypal.com https://cloudflareinsights.com",
    "worker-src 'self' blob:",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.paypal.com https://www.sandbox.paypal.com"
  ].join('; ');
  res.setHeader('Content-Security-Policy', cspPolicy);
  if (ENVIRONMENT !== 'PRODUCTION') {
    res.setHeader('Content-Security-Policy-Report-Only', cspPolicy);
  }

  if (ENVIRONMENT === 'PRODUCTION') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.get('/api/ping/', (_req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

app.get('/api/db-backup/', verifyToken, requireAdmin, (_req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

app.post('/api/refresh-seo-cache', async (req, res) => {
  const secret = process.env['CACHE_REFRESH_SECRET'];
  if (!secret) {
    // Endpoint is intentionally inactive when no secret is configured.
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const authHeader = req.headers['authorization'] || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!provided || provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    await ensureMongooseConnected();
    await refreshSeoCache();
    res.status(200).json({ ok: true, places: seoCache?.places.length ?? 0, posts: seoCache?.posts.length ?? 0 });
  } catch (err) {
    res.status(500).json({ error: 'Cache refresh failed' });
  }
})

app.use(express.json()); // this is needed to interprete req.body
app.use(cookieParser());
app.use('/api', async (_req, _res, next) => {
  try {
    await ensureMongooseConnected();
    next();
  } catch (error) {
    next(error);
  }
});
app.use(shop);
app.use(auth);
app.use(article);
app.use(map);
app.use(organisations);

app.use(express.static(browserDistFolder, {maxAge: '1y',index: false,redirect: false,}),);

const ARTICLE_SLUG_REDIRECTS: Record<string, string> = {
  'snorkelling-ipo': 'snorkelling-and-ipo',
};

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  const normalizedPath = normalizePath(req.path);
  const querySuffix = getQuerySuffix(req.query as Record<string, unknown>);

  if (normalizedPath === '/article') {
    res.redirect(301, `/articles${querySuffix}`);
    return;
  }

  if (normalizedPath === '/blog') {
    res.redirect(301, `/articles${querySuffix}`);
    return;
  }

  if (normalizedPath === '/home') {
    res.redirect(301, `/${querySuffix}`);
    return;
  }

  if (normalizedPath === '/faqs') {
    res.redirect(301, `/faq${querySuffix}`);
    return;
  }

  if (normalizedPath.startsWith('/article/section/')) {
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length === 3 && segments[2]) {
      res.redirect(301, `/articles/section/${encodeURIComponent(decodeURIComponent(segments[2]))}${querySuffix}`);
      return;
    }
  }

  if (normalizedPath.startsWith('/blog/section/')) {
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length === 3 && segments[2]) {
      res.redirect(301, `/articles/section/${encodeURIComponent(decodeURIComponent(segments[2]))}${querySuffix}`);
      return;
    }
  }

  next();
});

app.use(async (req, res, next) => {
  if (req.method !== 'GET' || !req.path.startsWith('/article/')) {
    if (req.method !== 'GET' || !req.path.startsWith('/blog/')) {
      next();
      return;
    }
  }
  const segments = req.path.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[1] === 'section') {
    next();
    return;
  }

  const slug = decodeURIComponent(segments[1] ?? '').trim().toLowerCase();
  if (!slug) {
    next();
    return;
  }

  const querySuffix = getQuerySuffix(req.query as Record<string, unknown>);

  const redirectSlug = ARTICLE_SLUG_REDIRECTS[slug] || slug;
  const canonicalPath = `/articles/${encodeURIComponent(redirectSlug)}`;
  res.redirect(301, `${canonicalPath}${querySuffix}`);
});

app.use(async (req, res, next) => {
  if (req.method !== 'GET' || !req.path.startsWith('/map/')) {
    next();
    return;
  }

  const { routePlaces } = await getSeoCache();

  const segments = req.path.split('/').filter(Boolean).slice(1);
  if (segments.length === 0) {
    next();
    return;
  }

  if (segments.length > 3) {
    sendNotFound(res);
    return;
  }

  const querySuffix = getQuerySuffix(req.query as Record<string, unknown>);
  const redirectTo = (path: string) => res.redirect(301, `${path}${querySuffix}`);

  const country = normaliseCountrySegment(segments[0]);
  if (!country) {
    redirectTo('/map');
    return;
  }

  if (segments.length === 1) {
    const canonicalPath = buildMapPath({ country });
    if (canonicalPath !== req.path) {
      redirectTo(canonicalPath);
      return;
    }
    next();
    return;
  }

  const county = normaliseCountySegment(segments[1]);
  if (!county) {
    sendNotFound(res);
    return;
  }

  // If cache is not ready yet, don't block first render with strict validation.
  if (!routePlaces.length) {
    next();
    return;
  }

  const countyMatches = getCountyMatchSlugs(county);
  const countyCountry = routePlaces.find((place: any) => countyMatches.has(place.countySlug))?.countrySlug ?? null;
  if (!countyCountry || countyCountry !== country) {
    sendNotFound(res);
    return;
  }

  if (segments.length === 2) {
    const canonicalPath = buildMapPath({ country, county });
    if (canonicalPath !== req.path) {
      redirectTo(canonicalPath);
      return;
    }
    next();
    return;
  }

  const siteSlug = normaliseSiteSegment(segments[2]);
  if (!siteSlug) {
    sendNotFound(res);
    return;
  }

  const place = findPlaceByRoute(routePlaces, country, county, siteSlug);
  if (!place?.path) {
    sendNotFound(res);
    return;
  }

  if (place.path !== req.path) {
    redirectTo(place.path);
    return;
  }

  next();
});

app.use(async (req, res, next) => {
  try {
    const response = await angularApp.handle(req);

    if (!response) {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(resolve(browserDistFolder, 'index.csr.html'), (err) => {
          if (err) {
            next(err);
          }
        });
        return;
      }
      next();
      return;
    }

    const contentType = response.headers.get('content-type') || '';

    if (req.method === 'GET' && contentType.includes('text/html')) {
      const html = await response.text();
      const forceNotFoundStatus = shouldForceNotFoundStatusFromHtml(html);

      const withSeo = await injectSeoIntoHtml(req.path, req.query as Record<string, string>, html, req.hostname);

      const headers = new Headers(response.headers);
      const cacheControl = getPublicHtmlCacheControl(req);
      if (cacheControl) {
        headers.set('cache-control', cacheControl);
      }
      headers.set('content-length', Buffer.byteLength(withSeo, 'utf8').toString());

      const rewritten = new Response(withSeo, {
        status: forceNotFoundStatus ? 404 : response.status,
        statusText: forceNotFoundStatus ? 'Not Found' : response.statusText,
        headers
      });

      await writeResponseToNodeResponse(rewritten, res);

      return;
    }

    await writeResponseToNodeResponse(response, res);

  } catch (error) {
    next(error);
  }
});

// Only run side effects (DB connection and listening on a port)
// when this module is executed as the main entry, not when imported for SSR builds.
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  void startServer();
}

export const reqHandler = createNodeRequestHandler(app);

async function startServer(): Promise<void> {
  const port = Number(process.env['PORT']) || 4000;

  app.listen(port, () => {
    // Warm dependencies in the background so startup does not block requests.
    void ensureMongooseConnected()
      .then(() => refreshSeoCache())
      .catch(() => {});
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureMongooseConnected() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongooseConnectPromise) {
    return mongooseConnectPromise;
  }

  mongooseConnectPromise = connectToMongoose();
  try {
    await mongooseConnectPromise;
  } finally {
    mongooseConnectPromise = null;
  }
}

async function connectToMongoose()  {
  const MONGO_URI = process.env['MONGO_URI'];
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not set in environment');
  }

  for (;;) {
    try {
      await mongoose.connect(MONGO_URI);
      return;
    } catch {
      await wait(5000);
    }
  }
}

export class ShopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopError"
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError"
  }
}

export class ArticleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleError"
  }
}
 
const SITE_URL = process.env['PUBLIC_SITE_URL'] || 'https://snorkelology.co.uk';
const FORCE_LOCAL_IMAGES = process.env['LOCAL_IMAGES'] === 'true';
const PUBLIC_HTML_EDGE_CACHE_CONTROL = 'public, max-age=0, s-maxage=120, stale-while-revalidate=300';

type SeoImageResizeOptions = {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'crop' | 'scale-down' | 'pad';
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
};

function normaliseAssetPath(value: string): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(`${SITE_URL}/assets/`)) {
    return trimmed.slice(SITE_URL.length);
  }
  if (trimmed.startsWith('/assets/')) {
    return trimmed;
  }
  if (trimmed.startsWith('assets/')) {
    return `/${trimmed}`;
  }

  return null;
}

function cloudflareResizedImagePath(assetPath: string, options: SeoImageResizeOptions = {}): string {
  const params = new URLSearchParams();
  if (options.width) params.set('width', String(options.width));
  if (options.height) params.set('height', String(options.height));
  if (options.quality) params.set('quality', String(options.quality));
  if (options.fit) params.set('fit', options.fit);
  if (options.format) params.set('format', options.format);

  const segment = params.toString().replace(/&/g, ',');
  return segment ? `/cdn-cgi/image/${segment}${assetPath}` : assetPath;
}

function seoImageUrl(sourceUrl: string, options: SeoImageResizeOptions = {}): string {
  const assetPath = normaliseAssetPath(sourceUrl);
  if (!assetPath) {
    return sourceUrl;
  }

  if (FORCE_LOCAL_IMAGES) {
    return assetPath;
  }

  return `${SITE_URL}${cloudflareResizedImagePath(assetPath, options)}`;
}

function defaultSeoSocialImageUrl(assetPath: string): string {
  return seoImageUrl(assetPath, {
    width: 1200,
    height: 630,
    quality: 75,
    fit: 'cover',
    format: 'auto',
  });
}

const MAP_SOCIAL_IMAGE = defaultSeoSocialImageUrl('/assets/snorkelology-unique-snorkel-map-of-britain.webp');
const DEFAULT_SOCIAL_IMAGE = defaultSeoSocialImageUrl('/assets/snorkelology opengraph image.webp');
const DEFAULT_TWITTER_IMAGE = defaultSeoSocialImageUrl('/assets/snorkelology logo for twitter og.webp');

function getPublicHtmlCacheControl(req: express.Request): string | null {
  if (req.hostname === 'admin.snorkelology.co.uk') {
    return null;
  }

  // Keep parameterised variants dynamic until explicitly reviewed for cache safety.
  if (Object.keys(req.query ?? {}).length > 0) {
    return null;
  }

  const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
  const isPublicPath =
    path === '/' ||
    path === '/home' ||
    path === '/articles' ||
    path.startsWith('/articles/') ||
    path === '/privacy-policy' ||
    path === '/affiliate-disclosure' ||
    path === '/ai-transparency' ||
    path === '/article' ||
    path.startsWith('/article/') ||
    path === '/map' ||
    path.startsWith('/map/');

  return isPublicPath ? PUBLIC_HTML_EDGE_CACHE_CONTROL : null;
}

async function refreshSeoCache(): Promise<void> {
  if (SKIP_SEO_DB_LOOKUPS) return;
  try {
    const [places, routePlaces, posts] = await Promise.all([
      getPlacesForSeo().catch(() => []),
      getPlacesForSeoWithRouteMeta().catch(() => []),
      getPublishedPostsForSeo().catch(() => [])
    ]);
    seoCache = { places, routePlaces, posts };
  } catch {
  }
}

async function getSeoCache(): Promise<SeoCache> {
  if (seoCache) return seoCache;
  scheduleSeoCacheRefresh();
  return { places: [], routePlaces: [], posts: [] };
}

function findPlaceByRoute(
  places: any[],
  countrySlug: string | null,
  countySlug: string | null,
  siteSlug: string
): any | null {
  const normalisedCountry = normaliseCountrySegment(countrySlug);
  const normalisedCounty = normaliseCountySegment(countySlug);
  const normalisedSite = normaliseSiteSegment(siteSlug);
  const countyMatches = normalisedCounty ? getCountyMatchSlugs(normalisedCounty) : null;

  const exactMatch = places.find((place: any) => {
    if (place.siteSlug !== normalisedSite) {
      return false;
    }
    if (normalisedCounty && place.countySlug && !countyMatches?.has(place.countySlug)) {
      return false;
    }
    if (normalisedCountry && place.countrySlug !== normalisedCountry) {
      return false;
    }
    return true;
  });

  if (exactMatch) {
    return exactMatch;
  }

  return places.find((place: any) => place.siteSlug === normalisedSite) ?? null;
}

function stripCanonicalTag(html: string): string {
  return html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '');
}

function isLocalHost(hostname: string | undefined): boolean {
  const host = (hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function toLocalAssetSeoUrl(value: string): string {
  if (!value) {
    return value;
  }

  if (value.startsWith('/assets/')) {
    return value;
  }

  if (value.startsWith(`${SITE_URL}/assets/`)) {
    return value.slice(SITE_URL.length);
  }

  const resizedMatch = value.match(/^(?:https?:\/\/[^/]+)?\/cdn-cgi\/image\/[^/]+(\/assets\/.*)$/i);
  if (resizedMatch?.[1]) {
    return resizedMatch[1];
  }

  return value;
}

function applyLocalSeoImageUrls(payload: SeoPayload): SeoPayload {
  return {
    ...payload,
    ogImage: toLocalAssetSeoUrl(payload.ogImage),
    twitterImage: toLocalAssetSeoUrl(payload.twitterImage),
  };
}

async function injectSeoIntoHtml(pathname: string, query: Record<string, string>, html: string, hostname?: string) {
  const payload = await getSeoPayload(pathname, query);
  if (!payload) {
    return stripCanonicalTag(html);
  }

  const resolvedPayload = isLocalHost(hostname) ? applyLocalSeoImageUrls(payload) : payload;

  return injectSeoPayloadIntoHtml(html, resolvedPayload, SITE_URL);
}

async function getSeoPayload(pathname: string, _query: Record<string, string> = {}): Promise<SeoPayload | null> {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === '/' || normalizedPath === '/home') {
    return getHomeSeoPayload();
  }

  if (normalizedPath === '/snorkelling-britain') {
    return getBookSeoPayload();
  }

  if (normalizedPath === '/shop') {
    return getShopSeoPayload();
  }

  if (normalizedPath === '/faq' || normalizedPath === '/faqs') {
    return getFaqSeoPayload();
  }

  if (normalizedPath === '/map' || normalizedPath.startsWith('/map/')) {
    const segments = normalizedPath.split('/').filter(Boolean).slice(1);
    const pathCountry = normaliseCountrySegment(segments[0]);
    const pathCounty = normaliseCountySegment(segments[1]);
    const pathSite = normaliseSiteSegment(segments[2]);

    const mapQueryNoindexKeys = new Set([
      'sitesWithin',
      'includeProviders',
      'site',
      'county',
      'district',
      'nation',
      'country',
      'region',
    ]);
    const shouldNoindexMapVariant = Object.keys(_query).some((key) => mapQueryNoindexKeys.has(key));

    const applyMapRobotsOverride = (payload: SeoPayload | null): SeoPayload | null => {
      if (!payload || !shouldNoindexMapVariant) return payload;
      const nonRobotsMetaTags = (payload.metaTags ?? []).filter((tag) => !(tag.key === 'name' && tag.keyValue === 'robots'));
      return {
        ...payload,
        metaTags: [
          ...nonRobotsMetaTags,
          { key: 'name', keyValue: 'robots', content: 'noindex,follow,max-image-preview:large' }
        ]
      };
    };

    if (pathSite) {
      return applyMapRobotsOverride(await getSiteSeoPayload(pathCountry, pathCounty, pathSite));
    }

    if (pathCountry && pathCounty) {
      return applyMapRobotsOverride(await getCountyMapSeoPayload(pathCountry, pathCounty));
    }

    if (pathCountry && NATION_SEO_CONFIG[pathCountry]) {
      return applyMapRobotsOverride(await getNationMapSeoPayload(pathCountry));
    }

    return applyMapRobotsOverride(await getMapSeoPayload());
  }

  if (normalizedPath === '/ai-transparency') {
    return getSimplePageSeoPayload(
      'AI Transparency Policy | Snorkelology',
      'Learn where AI assists Snorkelology content workflows, what is human-reviewed, and how editorial responsibility is maintained.',
      '/ai-transparency',
      'index,follow'
    );
  }

  if (normalizedPath === '/articles') {
    return getArticleIndexSeoPayload();
  }

  if (normalizedPath.startsWith('/articles/section/')) {
    const sectionSlug = getSectionSlugFromPath(normalizedPath);
    if (!sectionSlug) return null;
    return getArticleSectionSeoPayload(sectionSlug);
  }

  if (normalizedPath.startsWith('/articles/')) {
    const slug = normalizedPath.split('/').filter(Boolean)[1];
    if (!slug || slug === 'section') {
      return null;
    }
    return getArticleSeoPayload(slug);
  }

  if (normalizedPath === '/privacy-policy') {
    return getSimplePageSeoPayload('Privacy Policy | Snorkelology', '', '/privacy-policy');
  }

  if (normalizedPath === '/affiliate-disclosure') {
    return getSimplePageSeoPayload(
      'Affiliate Disclosure | Snorkelology',
      'Read how Snorkelology uses affiliate links, how recommendations stay editorially independent, and where disclosures appear across the site.',
      '/affiliate-disclosure'
    );
  }

  return null;
}

async function getHomeSeoPayload(): Promise<SeoPayload> {
  const description = 'Plan better UK snorkelling trips with Snorkelology: explore our interactive Britain map, read practical guides on safety, gear and marine life, and discover Snorkelling Britain: 100 Marine Adventures.';
  const keywords = 'snorkelling in britain, UK snorkelling map, best snorkelling sites UK, british snorkelling guides, snorkelling britain book';
  const orgSchema = {
    '@context': 'http://schema.org',
    '@type': 'Organization',
    name: 'Snorkelology',
    url: SITE_URL,
    logo: `${SITE_URL}/banner/snround.webp`,
    description,
    sameAs: [
      'https://instagram.com/snorkelology',
      'https://www.youtube.com/@snorkelology',
      'https://www.facebook.com/snorkelology'
    ]
  };

  const mapImageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    url: MAP_SOCIAL_IMAGE,
    name: 'Snorkelology interactive snorkelling map of Britain',
    description: 'An interactive map of the best snorkelling sites around the British coastline, created by Snorkelology.',
    representativeOfPage: true,
    contentUrl: MAP_SOCIAL_IMAGE,
  };

  const mapCreativeWorkSchema = {
    '@context': 'https://schema.org',
    '@type': 'Map',
    name: 'Snorkelling Map of Britain',
    description: 'An interactive map of 100+ of the best snorkelling sites around the British coastline, with GPS coordinates, site descriptions and categories.',
    url: `${SITE_URL}/map`,
    image: MAP_SOCIAL_IMAGE,
    creator: {
      '@type': 'Organization',
      name: 'Snorkelology',
      url: SITE_URL
    },
    about: {
      '@type': 'Thing',
      name: 'Snorkelling sites in Britain'
    },
    spatialCoverage: {
      '@type': 'Place',
      name: 'Britain',
      containedInPlace: {
        '@type': 'Country',
        name: 'United Kingdom'
      }
    }
  };

  // The @graph of all places is expensive (267 entries) and already present on /map.
  // Omitting it from the home page significantly reduces TBT without SEO cost.
  const schemas = [orgSchema, mapImageSchema, mapCreativeWorkSchema];

  return {
    title: 'Snorkelling in Britain: Map, Guides & Book | Snorkelology',
    description,
    keywords,
    canonicalPath: '/',
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas,
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

function buildDefaultMetaTags() {
  return [
    { key: 'name' as const, keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
    { key: 'property' as const, keyValue: 'og:site_name', content: 'Snorkelology' },
    { key: 'name' as const, keyValue: 'twitter:site', content: '@snorkelology' }
  ];
}

function buildProductSchemas(offerUrlPath: string) {
  return (shopItems.SHOP_ITEMS || []).map((item: any) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    description: item.description,
    image: item.images?.[0]?.src ? seoImageUrl(`/assets/${item.images[0].src}`) : undefined,
    sku: item.id,
    offers: {
      '@type': 'Offer',
      price: item.unit_amount?.value,
      priceCurrency: item.unit_amount?.currency_code,
      availability: item.isInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${SITE_URL}${offerUrlPath}`
    }
  }));
}

function buildBookSchemas(offerUrlPath: string) {
  return (shopItems.SHOP_ITEMS || [])
    .filter((item: any) => item.isbn)
    .map((item: any) => ({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: item.name,
      description: item.description,
      image: item.images?.[0]?.src ? seoImageUrl(`/assets/${item.images[0].src}`) : undefined,
      isbn: item.isbn,
      numberOfPages: item.numberOfPages,
      author: {
        '@type': 'Person',
        name: item.author
      },
      publisher: item.publisher ? {
        '@type': 'Organization',
        name: item.publisher
      } : undefined,
      offers: {
        '@type': 'Offer',
        price: item.unit_amount?.value,
        priceCurrency: item.unit_amount?.currency_code,
        availability: item.isInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: `${SITE_URL}${offerUrlPath}`
      }
    }));
}

function buildFaqSchema() {
  const faqAnswerToPlainText = (answer: string) => answer
    .replace(/\[link:([^,\]]+),([^\]]+)\]/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerToPlainText(faq.answer)
      }
    }))
  };
}

function buildBookVideoSchema() {
  const embedUrl = buildYouTubeEmbedUrl('nglkG5wdsmY');
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'Snorkelling Britain book flick-through video',
    description: 'A flick-through of Snorkelling Britain: 100 Marine Adventures, the guide to the best snorkelling sites around the British coastline.',
    thumbnailUrl: 'https://img.youtube.com/vi/nglkG5wdsmY/maxresdefault.jpg',
    uploadDate: '2025-06-01',
    embedUrl,
    contentUrl: 'https://www.youtube.com/watch?v=nglkG5wdsmY',
  };
}

function buildBookPageFaqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is Snorkelling Britain suitable for beginners?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Snorkelling Britain is designed for all levels and includes beginner-friendly sites, planning advice, and practical UK safety guidance.'
        }
      },
      {
        '@type': 'Question',
        name: 'Does the guide include England, Scotland, and Wales snorkelling sites?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The guide includes 100 snorkelling sites across England, Scotland, and Wales, with location details, access notes, and habitat highlights.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I buy a signed copy of Snorkelling Britain?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Signed copies are available via the Snorkelology shop when stock allows.'
        }
      }
    ]
  };
}

async function getBookSeoPayload(): Promise<SeoPayload> {
  const description = 'Explore Snorkelling Britain: 100 Marine Adventures, a practical guide to the UK\'s best snorkelling locations with route advice, safety notes, marine-life context, and underwater photography inspiration.';
  const keywords = 'snorkelling britain book, UK snorkelling guide book, british snorkelling book, signed snorkelling book';
  const bookOgImage = defaultSeoSocialImageUrl('/assets/photos/shop/snorkelling-britain-100-marine-adventures-book-cover.png');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Britain Book', item: `${SITE_URL}/snorkelling-britain` }
    ]
  };

  return {
    title: 'Snorkelling Britain Book: 100 Marine Adventures | Snorkelology',
    description,
    keywords,
    canonicalPath: '/snorkelling-britain',
    ogType: 'website',
    ogImage: bookOgImage,
    twitterImage: bookOgImage,
    schemas: [breadcrumbSchema, ...buildBookSchemas('/shop'), buildBookVideoSchema(), buildBookPageFaqSchema()],
    metaTags: buildDefaultMetaTags()
  };
}

async function getShopSeoPayload(): Promise<SeoPayload> {
  const description = 'Buy Snorkelling Britain and official Snorkelology merchandise with secure checkout, signed-copy options, and UK-friendly shipping from the authors.';
  const keywords = 'buy snorkelling britain, snorkelling gifts UK, signed snorkelling book, snorkelology shop';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` }
    ]
  };

  return {
    title: 'Buy Snorkelling Britain & Official Merch | Snorkelology Shop',
    description,
    keywords,
    canonicalPath: '/shop',
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas: [breadcrumbSchema, ...buildProductSchemas('/shop')],
    metaTags: buildDefaultMetaTags()
  };
}

async function getFaqSeoPayload(): Promise<SeoPayload> {
  const description = 'Get practical answers to common UK snorkelling questions on safety, kit, cold-water conditions, marine life, and how to start snorkelling around Britain.';
  const keywords = 'snorkelling FAQ UK, cold water snorkelling advice, snorkelling safety UK, marine life britain';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'FAQs', item: `${SITE_URL}/faq` }
    ]
  };

  return {
    title: 'UK Snorkelling FAQ: Safety, Kit, Marine Life | Snorkelology',
    description,
    keywords,
    canonicalPath: '/faq',
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas: [breadcrumbSchema, buildFaqSchema()],
    metaTags: buildDefaultMetaTags()
  };
}

const NATION_SEO_CONFIG: Record<string, { displayName: string; description: string }> = {
  'england': {
    displayName: 'England',
    description: 'Explore the best snorkelling locations across England on our interactive snorkelling map..',
  },
  'scotland': {
    displayName: 'Scotland',
    description: 'Explore the best snorkelling locations across Scotland on our interactive snorkelling map..',
  },
  'wales': {
    displayName: 'Wales',
    description: 'Explore the best snorkelling locations across Wales on our interactive snorkelling map..',
  },
  'britain': {
    displayName: 'Britain',
    description: 'Discover the best snorkelling locations across Britain on our interactive snorkelling map..',
  },
  'uk': {
    displayName: 'the UK',
    description: 'Discover the best snorkelling locations across the UK on our interactive snorkelling map..',
  },
};

async function getNationMapSeoPayload(nation: string): Promise<SeoPayload> {
  const { displayName, description } = NATION_SEO_CONFIG[nation];
  const nationPath = buildMapPath({ country: nation });

  const title = `Best Snorkelling Sites in ${displayName} | Snorkelology Map`;
  const keywords = `snorkelling ${displayName}, best snorkelling sites ${displayName}, where to snorkel in ${displayName}, snorkelling map ${displayName}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${SITE_URL}/map` },
      { '@type': 'ListItem', position: 3, name: `Snorkelling in ${displayName}`, item: `${SITE_URL}${nationPath}` }
    ]
  };

  const nationSiteEntries = await getMapSiteListEntries({ country: nation, limit: 18 });
  const collectionSchemas = buildMapCollectionSchemas({
    title: `Snorkelling sites in ${displayName}`,
    canonicalPath: nationPath,
    description,
    entries: nationSiteEntries
  });

  const isTopLevel = nation === 'britain' || nation === 'uk';
  const nationPlaceSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: displayName,
    url: `${SITE_URL}${nationPath}`,
    description,
    ...(isTopLevel ? {} : {
      containedInPlace: {
        '@type': 'Country',
        name: 'United Kingdom',
      },
    }),
  };

  return {
    title,
    description,
    keywords,
    canonicalPath: nationPath,
    ogType: 'website',
    ogImage: MAP_SOCIAL_IMAGE,
    twitterImage: MAP_SOCIAL_IMAGE,
    schemas: [breadcrumbSchema, nationPlaceSchema, ...collectionSchemas],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getSiteSeoPayload(country: string | null, county: string | null, siteSlug: string): Promise<SeoPayload | null> {
  const { routePlaces } = await getSeoCache();
  const place = findPlaceByRoute(routePlaces, country, county, siteSlug);
  if (!place) return null;

  const siteName = place.name as string;
  const isProvider = (place as any)['@type'] === 'SportsActivityLocation';
  const sitePath = place.path as string;
  const siteUrl = `${SITE_URL}${sitePath}`;
  const countryPath = place.countrySlug ? buildMapPath({ country: place.countrySlug }) : '/map';
  const countyPath = place.countrySlug && place.countySlug
    ? buildMapPath({ country: place.countrySlug, county: place.countySlug })
    : countryPath;

  const locationHint = place.district ? ` in ${place.district}` : '';
  const description = place.description
    || (isProvider
      ? `Plan snorkelling with ${siteName}${locationHint}: compare courses, guided trips, and snorkel-hire options from this provider profile.`
      : `Use this guide to snorkelling at ${siteName}${locationHint}, including route context from the Snorkelology interactive UK map.`);

  const locationKw = place.district ? ` ${place.district}` : '';
  const providerKeywords = isProvider ? [
    `snorkelling courses${locationKw}`,
    `snorkel training${locationKw}`,
    `guided snorkelling${locationKw}`,
    `snorkel hire${locationKw}`,
    `snorkelling lessons${locationKw}`,
    `snorkelling school${locationKw}`,
    `snorkel shop${locationKw}`,
  ] : [];

  const keywords = [
    place.keywords,
    `snorkelling ${siteName}`,
    isProvider ? `${siteName} snorkelling organisation` : `${siteName} snorkelling site`,
    ...providerKeywords
  ].filter(Boolean).join(', ');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${SITE_URL}/map` },
      ...(place.countrySlug ? [{ '@type': 'ListItem', position: 3, name: `Snorkelling in ${MAP_COUNTRY_DISPLAY_NAMES[place.countrySlug] ?? toTitleCase(place.countrySlug)}`, item: `${SITE_URL}${countryPath}` }] : []),
      ...(place.countySlug ? [{ '@type': 'ListItem', position: place.countrySlug ? 4 : 3, name: `Snorkelling in ${getCountyDisplayName(place.countySlug)}`, item: `${SITE_URL}${countyPath}` }] : []),
      { '@type': 'ListItem', position: place.countySlug ? 5 : place.countrySlug ? 4 : 3, name: siteName, item: siteUrl }
    ]
  };

  const {
    district: _district,
    countrySlug: _countrySlug,
    countySlug: _countySlug,
    siteSlug: _siteSlug,
    path: _path,
    ...placeSchemaFields
  } = place;

  const containedInPlace = place.countySlug
    ? {
        '@type': 'AdministrativeArea',
        name: getCountyDisplayName(place.countySlug),
        url: `${SITE_URL}${countyPath}`,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: MAP_COUNTRY_DISPLAY_NAMES[place.countrySlug ?? ''] ?? 'United Kingdom',
          url: `${SITE_URL}${countryPath}`,
        },
      }
    : place.countrySlug
      ? {
          '@type': 'AdministrativeArea',
          name: MAP_COUNTRY_DISPLAY_NAMES[place.countrySlug] ?? 'United Kingdom',
          url: `${SITE_URL}${countryPath}`,
        }
      : undefined;

  const placeSchema = {
    '@context': 'https://schema.org',
    ...placeSchemaFields,
    url: siteUrl,
    ...(!isProvider ? { touristType: 'Snorkelling' } : {}),
    ...(containedInPlace ? { containedInPlace } : {}),
  };

  return {
    title: isProvider
      ? `${siteName} | Snorkelling Courses, Guided Trips & Hire | Snorkelology`
      : `${siteName} Snorkelling Guide${place.countySlug ? ` (${getCountyDisplayName(place.countySlug)})` : ''} | Snorkelology`,
    description,
    keywords,
    canonicalPath: sitePath,
    ogType: 'website',
    ogImage: seoImageUrl(place.image || DEFAULT_SOCIAL_IMAGE, { width: 1200, height: 630, quality: 75, fit: 'cover', format: 'auto' }),
    twitterImage: seoImageUrl(place.image || DEFAULT_TWITTER_IMAGE, { width: 1200, height: 630, quality: 75, fit: 'cover', format: 'auto' }),
    schemas: [breadcrumbSchema, placeSchema],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

const COUNTY_EXTRA_KEYWORDS: Record<string, string[]> = {
  'isles-of-scilly': ['Scillies', 'Scilly Isles'],
  'north-ayrshire': ['Ayrshire'],
  'south-ayrshire': ['Ayrshire'],
  ayrshire: ['North Ayrshire', 'South Ayrshire'],
  moray: ['Aberdeenshire'],
  aberdeenshire: ['Moray'],
  'highland': ['Highlands', 'Scottish Highlands'],
  'na-h-eileanan-siar': ['Outer Hebrides', 'Western Isles'],
  'east-riding-of-yorkshire': ['East Yorkshire'],
  'isle-of-anglesey': ['Anglesey'],
  'orkney-islands': ['Orkney'],
};

type MapSiteListEntry = {
  name: string;
  path: string;
  description?: string;
};

async function getMapSiteListEntries(filters: { country?: string; county?: string; limit: number }): Promise<MapSiteListEntry[]> {
  const sites = await FeatureModel.find(
    {
      showOnMap: 'Production',
      'properties.featureType': 'Snorkelling Site'
    },
    { location: 1, properties: 1 }
  ).lean();

  return (sites as any[])
    .map((site: any) => {
      const properties = site.properties ?? {};
      const location = properties.location ?? {};
      const countrySlug = getCountrySlugFromRegion(location.region);
      const countySlug = getCountySlugFromLocation(location);
      return {
        name: properties.name as string,
        description: properties.description as string | undefined,
        countrySlug,
        countySlug,
        path: buildMapPath({ country: countrySlug, county: countySlug, siteName: properties.name as string })
      };
    })
    .filter((item: any) => typeof item.name === 'string' && item.name.trim() !== '')
    .filter((item: any) => !filters.country || item.countrySlug === filters.country)
    .filter((item: any) => !filters.county || item.countySlug === filters.county)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
    .slice(0, filters.limit)
    .map((item: any) => ({
      name: item.name,
      path: item.path,
      description: item.description,
    }));
}

function buildMapCollectionSchemas(options: {
  title: string;
  canonicalPath: string;
  description: string;
  entries: MapSiteListEntry[];
}) {
  if (!options.entries.length) {
    return [];
  }

  const itemListId = `${SITE_URL}${options.canonicalPath}#featured-sites`;
  const itemListElements = options.entries.map((entry, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: entry.name,
    url: `${SITE_URL}${entry.path}`,
    ...(entry.description ? { description: entry.description } : {})
  }));

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@id': itemListId,
    '@type': 'ItemList',
    name: `${options.title} featured snorkelling sites`,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: itemListElements.length,
    itemListElement: itemListElements
  };

  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: options.title,
    description: options.description,
    url: `${SITE_URL}${options.canonicalPath}`,
    mainEntity: { '@id': itemListId }
  };

  return [collectionPageSchema, itemListSchema];
}

async function getCountyMapSeoPayload(country: string, county: string): Promise<SeoPayload> {
  const countyMatches = getCountyMatchSlugs(county);
  const canonicalCountry = (await getSeoCache()).routePlaces.find((place: any) => countyMatches.has(place.countySlug))?.countrySlug ?? country;
  const displayName = getCountyDisplayName(county);
  const countryDisplayName = MAP_COUNTRY_DISPLAY_NAMES[canonicalCountry] ?? toTitleCase(canonicalCountry);
  const countryPath = buildMapPath({ country: canonicalCountry });
  const countyPath = buildMapPath({ country: canonicalCountry, county });
  const extraKeywords = COUNTY_EXTRA_KEYWORDS[county] ?? [];

  const title = `Snorkelling in ${displayName}: Best Sites & Conditions | Snorkelology`;
  const description = `Find the best snorkelling spots in ${displayName} with mapped locations, descriptions, GPS coordinates, and how to find out more information.`;
  const baseKeywords = `snorkelling ${displayName}, snorkelling sites ${displayName}, where to snorkel in ${displayName}, snorkelling map ${displayName}, best snorkelling ${displayName}`;
  const keywords = extraKeywords.length
    ? `${baseKeywords}, ${extraKeywords.map(k => `snorkelling ${k}`).join(', ')}`
    : baseKeywords;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${SITE_URL}/map` },
      { '@type': 'ListItem', position: 3, name: `Snorkelling in ${countryDisplayName}`, item: `${SITE_URL}${countryPath}` },
      { '@type': 'ListItem', position: 4, name: `Snorkelling in ${displayName}`, item: `${SITE_URL}${countyPath}` }
    ]
  };

  const countySiteEntries = await getMapSiteListEntries({ country: canonicalCountry, county, limit: 18 });
  const collectionSchemas = buildMapCollectionSchemas({
    title: `Snorkelling sites in ${displayName}`,
    canonicalPath: countyPath,
    description,
    entries: countySiteEntries
  });

  const countyPlaceSchema = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: displayName,
    url: `${SITE_URL}${countyPath}`,
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: countryDisplayName,
      url: `${SITE_URL}${countryPath}`,
    },
    description: `${displayName} is a coastal area in ${countryDisplayName} with ${countySiteEntries.length} mapped snorkelling site${countySiteEntries.length === 1 ? '' : 's'} on the Snorkelology interactive map.`,
  };

  return {
    title,
    description,
    keywords,
    canonicalPath: countyPath,
    ogType: 'website',
    ogImage: MAP_SOCIAL_IMAGE,
    twitterImage: MAP_SOCIAL_IMAGE,
    schemas: [breadcrumbSchema, countyPlaceSchema, ...collectionSchemas],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getMapSeoPayload(): Promise<SeoPayload> {
  const description = 'Explore the best British snorkelling spots on our interactive snorkelling map.';
  const keywords = [
    // Core intent
    'snorkelling map of britain', 'interactive snorkelling map UK', 'british snorkelling map',
    'snorkelling sites map', 'snorkelling locations UK', 'best snorkelling spots UK',
    // Long-tail "where to snorkel"
    'where to snorkel in Britain', 'where to snorkel in the UK', 'where to snorkel in England',
    'where to snorkel in Scotland', 'where to snorkel in Wales',
    'best places to snorkel in Britain', 'best places to snorkel UK',
    'snorkelling spots near me', 'snorkelling beaches UK',
    // Habitat types
    'rock pool snorkelling UK', 'kelp forest snorkelling', 'reef snorkelling Britain',
    'snorkelling coves', 'coastal snorkelling UK',
    // Activity context
    'snorkelling guide Britain', 'UK snorkelling sites', 'snorkelling locations Britain',
    'snorkelling organisations UK', 'guided snorkelling UK',
    // Provider / training intent
    'snorkel training UK', 'snorkelling courses UK', 'snorkelling lessons UK',
    'snorkel hire UK', 'snorkelling instruction UK', 'snorkel school UK',
    'snorkelling club UK', 'snorkelling near me',
    // Brand
    'snorkelology map', 'snorkelology snorkelling map'
  ].join(', ');

  const { places: mapPlaces } = await getSeoCache();
  const mapSchema = mapPlaces.length ? {
    '@context': 'https://schema.org',
    '@graph': mapPlaces
  } : null;

  const mapCreativeWorkSchema = {
    '@context': 'https://schema.org',
    '@type': 'Map',
    name: 'Interactive Snorkelling Map of Britain — 100+ Sites',
    description,
    url: `${SITE_URL}/map`,
    image: MAP_SOCIAL_IMAGE,
    creator: {
      '@type': 'Organization',
      name: 'Snorkelology',
      url: SITE_URL
    },
    about: [
      { '@type': 'Thing', name: 'Snorkelling sites in Britain' },
      { '@type': 'Thing', name: 'Coastal snorkelling UK' },
      { '@type': 'Thing', name: 'Rock pool snorkelling' },
      { '@type': 'Thing', name: 'Kelp forest snorkelling' },
      { '@type': 'Thing', name: 'Snorkelling organisations UK' }
    ],
    keywords: 'snorkelling map UK, best snorkelling spots Britain, where to snorkel UK, coastal snorkelling, rock pools, kelp forests',
    spatialCoverage: {
      '@type': 'Place',
      name: 'Britain',
      containedInPlace: {
        '@type': 'Country',
        name: 'United Kingdom'
      }
    }
  };

  const mapImageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    url: MAP_SOCIAL_IMAGE,
    name: 'Snorkelology interactive snorkelling map of Britain',
    description: 'An interactive map of the best snorkelling sites around the British coastline, created by Snorkelology.',
    representativeOfPage: true,
    contentUrl: MAP_SOCIAL_IMAGE,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${SITE_URL}/map` }
    ]
  };

  return {
    title: 'Interactive UK Snorkelling Map (100+ Sites) | Snorkelology',
    description,
    keywords,
    canonicalPath: '/map',
    ogType: 'website',
    ogImage: MAP_SOCIAL_IMAGE,
    twitterImage: MAP_SOCIAL_IMAGE,
    schemas: [breadcrumbSchema, mapCreativeWorkSchema, mapImageSchema, ...(mapSchema ? [mapSchema] : [])],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getArticleIndexSeoPayload(): Promise<SeoPayload> {
  const description = 'Read in-depth British snorkelling articles covering stories, reviews, safety, gear choices, marine-life and more.';
  const keywords = 'British snorkelling articles, UK snorkelling articles, snorkelling safety UK, snorkelling gear guides, marine life Britain';

  const articleListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'British Snorkelling Articles',
    description,
    url: `${SITE_URL}/articles`,
    publisher: {
      '@type': 'Organization',
      name: 'Snorkelology',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/banner/snround.webp` }
    }
  };

  return {
    title: 'UK Snorkelling Articles: Safety, Gear, Marine Life | Snorkelology',
    description,
    keywords,
    canonicalPath: '/articles',
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas: [articleListSchema],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getArticleSectionSeoPayload(sectionSlug: string): Promise<SeoPayload> {
  const humanizeSection = (value: string) => value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  const sectionTitle = humanizeSection(sectionSlug) || 'British Snorkelling';
  const description = `Explore ${sectionTitle} snorkelling articles with practical UK guidance, marine-life context, and field-tested trip planning advice.`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: `${SITE_URL}/articles` },
      { '@type': 'ListItem', position: 3, name: sectionTitle, item: `${SITE_URL}/articles/section/${encodeURIComponent(sectionSlug)}` }
    ]
  };

  const sectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${sectionTitle} Articles`,
    description,
    url: `${SITE_URL}/articles/section/${encodeURIComponent(sectionSlug)}`,
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'British Snorkelling Articles',
      url: `${SITE_URL}/articles`
    },
    publisher: {
      '@type': 'Organization',
      name: 'Snorkelology',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/banner/snround.webp` }
    }
  };

  return {
    title: `${sectionTitle} Articles | Snorkelology`,
    description,
    keywords: `${sectionTitle.toLowerCase()} snorkelling, UK snorkelling ${sectionTitle.toLowerCase()}, snorkelology articles`,
    canonicalPath: `/articles/section/${encodeURIComponent(sectionSlug)}`,
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas: [breadcrumbSchema, sectionSchema],
    metaTags: buildDefaultMetaTags()
  };
}

async function getArticleSeoPayload(slug: string): Promise<SeoPayload | null> {
  if (SKIP_SEO_DB_LOOKUPS) {
    return null;
  }

  const post = await getPublishedPostBySlugForSeo(slug);
  if (!post) {
    return null;
  }

  // Fix 1: fall back to stripped intro if subtitle is blank
  const isReviewType = post.type === 'review';
  const reviewModel = (post as any).review || {};
  const rawDescription = post.subtitle || reviewModel.summary || post.intro || '';
  const description = rawDescription.replace(/<[^>]*>/g, '').slice(0, 300).trim();

  const hasGeneratedOgImage = await generatedOgImageExists(slug);
  const imageUrl = seoImageUrl(hasGeneratedOgImage
    ? `${SITE_URL}/assets/photos/articles/og/${slug}-og.webp`
    : (post.imgFname ? `${SITE_URL}/assets/${post.imgFname}` : DEFAULT_SOCIAL_IMAGE),
    { width: 1200, height: 630, quality: 75, fit: 'cover', format: 'auto' });

  // Fix 5: use ImageObject instead of plain string
  const imageObject = {
    '@type': 'ImageObject',
    url: imageUrl,
    width: 1200,
    height: 630
  };

  const isFaqType = post.type === 'faq';
  const reviewKind = reviewModel.reviewKind === 'book' ? 'book' : 'product';
  const isProductReview = isReviewType && !isFaqType && reviewKind === 'product';
  const isBookReview = isReviewType && !isFaqType && reviewKind === 'book';
  const publishedIso = new Date(post.createdAt || new Date()).toISOString();
  const modifiedIso = new Date(post.updatedAt || post.createdAt || new Date()).toISOString();
  const authorName = post.author || 'Snorkelology';
  const articleUrl = `${SITE_URL}/articles/${slug}`;
  const seoOnlyArticleKeywords = ['snorkelling', 'british snorkelling', 'snorkelling guide'];
  const reviewOnlyKeywords = isProductReview
    ? ['product review', 'gear review', 'hands-on review']
    : isBookReview
      ? ['book review', 'reading review', 'book recommendation']
      : [];
  const schemaKeywords = Array.from(new Set([...(post.keywords || []), ...seoOnlyArticleKeywords, ...reviewOnlyKeywords]));
  const schemaKeywordsCsv = schemaKeywords.join(', ');

  const normaliseSectionSlug = (value?: string) => (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const sectionSlug = normaliseSectionSlug((post as any).articleSection);
  const sectionTitle = (post as any).articleSection ? String((post as any).articleSection).trim() : 'Articles';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: `${SITE_URL}/articles` },
      ...(sectionSlug ? [{ '@type': 'ListItem', position: 3, name: sectionTitle, item: `${SITE_URL}/articles/section/${encodeURIComponent(sectionSlug)}` }] : []),
      { '@type': 'ListItem', position: sectionSlug ? 4 : 3, name: post.title || 'Article', item: articleUrl }
    ]
  };

  // Fix 4: add url, publisher, mainEntityOfPage; Fix 7: FAQ uses 'article' ogType
  const baseArticlePostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'ArticlePosting',
    headline: post.title,
    description,
    keywords: schemaKeywordsCsv,
    image: imageObject,
    url: articleUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    datePublished: publishedIso,
    dateModified: modifiedIso,
    author: { '@type': 'Person', name: authorName },
    publisher: {
      '@type': 'Organization',
      name: 'Snorkelology',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/banner/snround.webp` }
    }
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (post.sections || []).map((section: any) => ({
      '@type': 'Question',
      name: section.title,
      acceptedAnswer: {
        '@type': 'Answer',
        text: section.content || ''
      }
    }))
  };

  const primarySchemas = isFaqType
    ? [baseArticlePostingSchema, faqSchema]
    : [baseArticlePostingSchema];

  const reviewSchemas = isProductReview
    ? (() => {
        const ratingScale = Math.max(1, Number(reviewModel.ratingScale || 5));
        const ratingValue = Math.min(ratingScale, Math.max(0, Number(reviewModel.ratingValue || 0)));
        const productName = (reviewModel.productName || post.title || '').trim();
        const itemReviewedType = isBookReview ? 'Book' : 'Product';
        const productSchema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': itemReviewedType,
          name: productName,
          image: imageUrl,
          brand: isProductReview && reviewModel.brand ? { '@type': 'Brand', name: reviewModel.brand } : undefined,
          author: isBookReview && reviewModel.author ? { '@type': 'Person', name: reviewModel.author } : undefined,
          publisher: isBookReview && reviewModel.publisher ? { '@type': 'Organization', name: reviewModel.publisher } : undefined,
          isbn: isBookReview && reviewModel.isbn ? reviewModel.isbn : undefined,
          sku: reviewModel.sku || undefined,
          description: (reviewModel.summary || description || '').replace(/<[^>]*>/g, '').slice(0, 300).trim(),
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue,
            bestRating: ratingScale,
            worstRating: 0,
            ratingCount: 1,
            reviewCount: 1,
          },
        };

        if (reviewModel.priceValue || reviewModel.availability) {
          productSchema['offers'] = {
            '@type': 'Offer',
            priceCurrency: reviewModel.priceCurrency || 'GBP',
            price: reviewModel.priceValue || undefined,
            availability: reviewModel.availability || undefined,
            url: reviewModel.affiliateLinks?.[0]?.url || articleUrl,
          };
        }

        const reviewSchema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'Review',
          url: articleUrl,
          datePublished: publishedIso,
          dateModified: modifiedIso,
          reviewBody: (reviewModel.summary || description || '').replace(/<[^>]*>/g, '').trim(),
          author: { '@type': 'Person', name: authorName },
          publisher: { '@type': 'Organization', name: 'Snorkelology' },
          itemReviewed: {
            '@type': itemReviewedType,
            name: productName,
            brand: isProductReview && reviewModel.brand ? { '@type': 'Brand', name: reviewModel.brand } : undefined,
            author: isBookReview && reviewModel.author ? { '@type': 'Person', name: reviewModel.author } : undefined,
            publisher: isBookReview && reviewModel.publisher ? { '@type': 'Organization', name: reviewModel.publisher } : undefined,
            isbn: isBookReview && reviewModel.isbn ? reviewModel.isbn : undefined,
            image: imageUrl,
          },
          reviewRating: {
            '@type': 'Rating',
            ratingValue,
            bestRating: ratingScale,
            worstRating: 0,
          },
        };

        if (Array.isArray(reviewModel.pros) && reviewModel.pros.length > 0) {
          reviewSchema['positiveNotes'] = {
            '@type': 'ItemList',
            itemListElement: reviewModel.pros.map((text: string, index: number) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: text,
            })),
          };
        }

        if (Array.isArray(reviewModel.cons) && reviewModel.cons.length > 0) {
          reviewSchema['negativeNotes'] = {
            '@type': 'ItemList',
            itemListElement: reviewModel.cons.map((text: string, index: number) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: text,
            })),
          };
        }

        return [productSchema, reviewSchema];
      })()
    : [];

  const videoSchemas = (post.sections || []).flatMap((section: any) => {
    if (!section.videoUrl) return [];

    const videoId = extractYouTubeVideoId(section.videoUrl);
    if (!videoId) return [];

    return [{
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: section.title || post.title,
      description: (section.content || description).replace(/<[^>]*>/g, '').slice(0, 300).trim(),
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      uploadDate: publishedIso,
      embedUrl: buildYouTubeEmbedUrl(videoId),
      contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }];
  });

  // Fix 6: emit keywords as article:tag meta properties
  const keywordTags = schemaKeywords.map((kw: string) => ({
    key: 'property' as const,
    keyValue: 'article:tag',
    content: kw
  }));

  const reviewMetaTags: SeoMetaTag[] = [];
  if (isProductReview) {
    reviewMetaTags.push({ key: 'property', keyValue: 'product:price:currency', content: (reviewModel.priceCurrency || 'GBP') });
    if (reviewModel.priceValue) {
      reviewMetaTags.push({ key: 'property', keyValue: 'product:price:amount', content: String(reviewModel.priceValue) });
    }
  }

  return {
    title: post.title || 'Snorkelology Article',
    description,
    keywords: schemaKeywordsCsv,
    canonicalPath: `/articles/${slug}`,
    ogType: 'article',  // Fix 7: always 'article' for individual posts
    ogImage: imageUrl,
    twitterImage: imageUrl,  // Fix 2: use article image for Twitter
    schemas: [breadcrumbSchema, ...primarySchemas, ...reviewSchemas, ...videoSchemas],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' },
      { key: 'property', keyValue: 'article:published_time', content: publishedIso },
      { key: 'property', keyValue: 'article:modified_time', content: modifiedIso },
      { key: 'property', keyValue: 'article:author', content: authorName },
      ...reviewMetaTags,
      ...keywordTags
    ]
  };
}

async function generatedOgImageExists(slug: string) {
  const candidates = [
    resolve(process.cwd(), 'dist/prod/browser/assets/photos/articles/og', `${slug}-og.webp`),
    resolve(process.cwd(), 'src/assets/photos/articles/og', `${slug}-og.webp`)
  ];

  for (const filePath of candidates) {
    try {
      await access(filePath);
      return true;
    } catch {
      // Keep checking other known asset roots.
    }
  }

  return false;
}


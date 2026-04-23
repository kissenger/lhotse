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
import { auth, verifyToken } from './server-auth';
import { blog, getPublishedPostBySlugForSeo, getPublishedPostsForSeo } from './server-blog';
import { getPlacesForSeo, getPlaceForSeoByRoute, getCountrySlugForCounty, map } from './server-map';
import { organisations } from './server-organisations';
import { injectSeoPayloadIntoHtml, type SeoPayload } from './server-seo-injection';
import { shopItems } from './environments/environment._shopItems';
import { faqItems } from './app/shared/faq-data';
import { MAP_COUNTRY_DISPLAY_NAMES, buildMapPath, getCountrySlugFromRegion, getCountyDisplayName, getCountySlugFromLocation, normaliseCountrySegment, normaliseCountySegment, normaliseSiteSegment, toTitleCase } from './app/shared/map-paths';
import 'dotenv/config';

const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
const SKIP_SEO_DB_LOOKUPS = process.env['SKIP_SEO_DB_LOOKUPS'] === 'true';
const app = express();
app.use(compression());
const angularApp = new AngularNodeAppEngine();
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
let mongooseConnectPromise: Promise<void> | null = null;

/**
 * In-memory SEO cache.
 * Populated on server startup (pre-warm) so every request is served from RAM.
 * Refreshed by the daily RPi restart, or on demand via POST /api/refresh-seo-cache.
 */
interface SeoCache {
  places: any[];
  posts: any[];
}
let seoCache: SeoCache | null = null;

/**
 * Admin subdomain handling:
 * - Redirect root path to /dashboard (avoids Angular SSR redirect-response falling through)
 * - Rewrite Host header so Angular's SSR host-validation passes
 * - Block search engine indexing
 */
app.use((req, res, next) => {
  if (req.hostname === 'admin.snorkelology.co.uk') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.path === '/') {
      res.redirect(302, '/dashboard');
      return;
    }
    req.headers['host'] = 'snorkelology.co.uk';
  }
  next();
});

/**
 * Security headers
 */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (ENVIRONMENT === 'PRODUCTION') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

/**
 * Start of API routes
 */
app.get('/api/ping/', (_req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

app.get('/api/db-backup/', verifyToken, (_req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

/**
 * POST /api/refresh-seo-cache
 *
 * Forces an immediate refresh of the in-memory SEO cache (map places + blog posts).
 * Intended for use by a cron job or deployment hook to invalidate the cache
 * without restarting the server.
 *
 * Usage:
 *   curl -X POST https://snorkelology.co.uk/api/refresh-seo-cache \
 *        -H "Authorization: Bearer <CACHE_REFRESH_SECRET>"
 *
 * Authentication:
 *   Requires the Authorization header value to match the CACHE_REFRESH_SECRET
 *   environment variable. If that variable is not set, the endpoint returns 404
 *   so it cannot be discovered or abused.
 *
 * Cron example (runs at 03:00 every day):
 *   0 3 * * * curl -s -X POST https://snorkelology.co.uk/api/refresh-seo-cache \
 *             -H "Authorization: Bearer $(cat /etc/seo-cache-secret)"
 */
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
    console.error('POST /api/refresh-seo-cache failed:', err);
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
app.use(blog);
app.use(map);
app.use(organisations);

/**
 * End of API routes
 */

app.use(express.static(browserDistFolder, {maxAge: '1y',index: false,redirect: false,}),);

app.use(async (req, res, next) => {
  if (req.method !== 'GET' || !req.path.startsWith('/map/')) {
    next();
    return;
  }

  const segments = req.path.split('/').filter(Boolean).slice(1);
  if (segments.length === 0) {
    next();
    return;
  }

  if (segments.length > 3) {
    res.status(404).send('Not found');
    return;
  }

  const passthrough = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      passthrough.set(key, value);
    }
  }

  const redirectTo = (path: string) => {
    const query = passthrough.toString();
    res.redirect(301, query ? `${path}?${query}` : path);
  };

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
    res.status(404).send('Not found');
    return;
  }

  const countyCountry = await getCountrySlugForCounty(county).catch(() => null);
  if (!countyCountry || countyCountry !== country) {
    res.status(404).send('Not found');
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
    res.status(404).send('Not found');
    return;
  }

  const place = await getPlaceForSeoByRoute(country, county, siteSlug).catch(() => null);
  if (!place?.path) {
    res.status(404).send('Not found');
    return;
  }

  if (place.path !== req.path) {
    redirectTo(place.path);
    return;
  }

  next();
});

app.use((req, res, next) => {
  angularApp.handle(req)
    .then(async (response) => {
      if (!response) {
        next();
        return;
      }

      const contentType = response.headers.get('content-type') || '';

      if (req.method === 'GET' && contentType.includes('text/html')) {
        const html = await response.text();
        const withSeo = await injectSeoIntoHtml(req.path, req.query as Record<string, string>, html);
        const headers = new Headers(response.headers);
        headers.set('content-length', Buffer.byteLength(withSeo, 'utf8').toString());

        const rewritten = new Response(withSeo, {
          status: response.status,
          statusText: response.statusText,
          headers
        });

        writeResponseToNodeResponse(rewritten, res);
        return;
      }

      writeResponseToNodeResponse(response, res);
    })
    .catch(next);
});

// Only run side effects (DB connection and listening on a port)
// when this module is executed as the main entry, not when imported for SSR builds.
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  void startServer();
}

export const reqHandler = createNodeRequestHandler(app);

/**
 * Function to connect to mongo, and retry if unsuccesful
 * note that once connected, mongoose handles reconnection attempts
 * @returns 
 */
async function startServer() {
  await ensureMongooseConnected();
  await refreshSeoCache();

  const PORT = ENVIRONMENT === 'PRODUCTION' ? 4001 : 4000;
  app.listen(PORT, () => {
    console.log(`Node Express server listening on port ${PORT}`);
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
    } catch (error) {
      console.error('Mongoose failed to connect, retrying in 5000ms...');
      console.error(error);
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

export class BlogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlogError"
  }
}
 
const SITE_URL = 'https://snorkelology.co.uk';
const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/assets/snorkelology opengraph image.png`;
const DEFAULT_TWITTER_IMAGE = `${SITE_URL}/assets/snorkelology logo for twitter og.png`;

/**
 * Fetches places and blog posts from the DB in parallel and stores them in the
 * in-memory SEO cache. Called once on startup (pre-warm) and optionally via
 * POST /api/refresh-seo-cache.
 */
async function refreshSeoCache(): Promise<void> {
  if (SKIP_SEO_DB_LOOKUPS) return;
  try {
    const [places, posts] = await Promise.all([
      getPlacesForSeo().catch((err) => { console.error('SEO cache: getPlacesForSeo failed', err); return []; }),
      getPublishedPostsForSeo().catch((err) => { console.error('SEO cache: getPublishedPostsForSeo failed', err); return []; })
    ]);
    seoCache = { places, posts };
    console.log(`SEO cache refreshed: ${places.length} places, ${posts.length} posts`);
  } catch (err) {
    console.error('SEO cache refresh failed:', err);
  }
}

/**
 * Returns the SEO cache, populating it first if it is empty (lazy fallback).
 * Under normal operation the cache is always pre-warmed on startup, so the
 * lazy path is only reached if the startup pre-warm itself failed.
 */
async function getSeoCache(): Promise<SeoCache> {
  if (seoCache) return seoCache;
  await refreshSeoCache();
  return seoCache ?? { places: [], posts: [] };
}

async function injectSeoIntoHtml(pathname: string, query: Record<string, string>, html: string) {
  const payload = await getSeoPayload(pathname, query);
  if (!payload) {
    return html;
  }

  return injectSeoPayloadIntoHtml(html, payload, SITE_URL);
}

async function getSeoPayload(pathname: string, _query: Record<string, string> = {}): Promise<SeoPayload | null> {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (normalizedPath === '/' || normalizedPath === '/home') {
    return getHomeSeoPayload();
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
    return {
      title: 'AI Transparency | Snorkelology',
      description: 'How Snorkelology uses AI to help describe snorkelling organisations on our interactive map of Britain.',
      keywords: '',
      canonicalPath: '/ai-transparency',
      ogType: 'website' as const,
      ogImage: '',
      twitterImage: '',
      schemas: [],
      metaTags: [
        { key: 'name' as const, keyValue: 'robots', content: 'index,follow' }
      ]
    };
  }

  if (normalizedPath === '/blog') {
    return getBlogIndexSeoPayload();
  }

  if (normalizedPath.startsWith('/blog/')) {
    const slug = normalizedPath.split('/').filter(Boolean)[1];
    if (!slug) {
      return null;
    }
    return getBlogSeoPayload(slug);
  }

  if (normalizedPath === '/privacy-policy') {
    return {
      title: 'Privacy Policy | Snorkelology',
      description: '',
      keywords: '',
      canonicalPath: '/privacy-policy',
      ogType: 'website',
      ogImage: '',
      twitterImage: '',
      schemas: [],
      metaTags: [
        { key: 'name', keyValue: 'robots', content: 'noindex,follow' }
      ]
    };
  }

  return null;
}

async function getHomeSeoPayload(): Promise<SeoPayload> {
  const description = 'Snorkelology \u2014 your guide to the best snorkelling in Britain. Explore our interactive snorkelling map, browse articles on marine life, gear and safety, and buy Snorkelling Britain: 100 Marine Adventures.';
  const keywords = 'snorkel, snorkeling, snorkelling, snorkelling britain, british snorkelling, snorkelling book, buy snorkelling britain, UK snorkelling sites, underwater photography, sealife, marinelife, snorkelling map, map';
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

  const productSchemas = (shopItems.SHOP_ITEMS || []).map((item: any) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    description: item.description,
    image: item.images?.[0]?.src ? `${SITE_URL}/assets/${item.images[0].src}` : undefined,
    sku: item.id,
    offers: {
      '@type': 'Offer',
      price: item.unit_amount?.value,
      priceCurrency: item.unit_amount?.currency_code,
      availability: item.isInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${SITE_URL}/#buy-now`
    }
  }));

  const bookSchemas = (shopItems.SHOP_ITEMS || [])
    .filter((item: any) => item.isbn)
    .map((item: any) => ({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: item.name,
      description: item.description,
      image: item.images?.[0]?.src ? `${SITE_URL}/assets/${item.images[0].src}` : undefined,
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
        url: `${SITE_URL}/#buy-now`
      }
    }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };

  const { posts: seoPosts } = await getSeoCache();

  const blogSchemas = seoPosts.map((post: any) => ({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.subtitle || post.intro || post.title,
        image: post.imgFname ? `${SITE_URL}/assets/photos/articles/${post.imgFname}` : undefined,
        datePublished: post.createdAt,
        dateModified: post.updatedAt || post.createdAt,
        author: {
          '@type': 'Person',
          name: 'Snorkelology'
        }
      }));

  const homepageVideoSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'Snorkelling Britain book flick-through video',
    description: 'A flick-through of Snorkelling Britain: 100 Marine Adventures, the guide to the best snorkelling sites around the British coastline.',
    thumbnailUrl: 'https://img.youtube.com/vi/nglkG5wdsmY/maxresdefault.jpg',
    uploadDate: '2025-06-01',
    embedUrl: 'https://www.youtube.com/embed/nglkG5wdsmY',
    contentUrl: 'https://www.youtube.com/watch?v=nglkG5wdsmY',
  };

  const mapImageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    url: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    name: 'Snorkelology interactive snorkelling map of Britain',
    description: 'An interactive map of the best snorkelling sites around the British coastline, created by Snorkelology.',
    representativeOfPage: true,
    contentUrl: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
  };

  const mapCreativeWorkSchema = {
    '@context': 'https://schema.org',
    '@type': 'Map',
    name: 'Snorkelling Map of Britain',
    description: 'An interactive map of 100+ of the best snorkelling sites around the British coastline, with GPS coordinates, site descriptions and categories.',
    url: `${SITE_URL}/map`,
    image: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
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
  const schemas = [orgSchema, ...productSchemas, ...bookSchemas, faqSchema, ...blogSchemas, mapImageSchema, mapCreativeWorkSchema, homepageVideoSchema];

  return {
    title: 'Snorkelology \u2014 British Snorkelling Map, Articles & Snorkelling Britain Book',
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

const NATION_SEO_CONFIG: Record<string, { displayName: string; description: string }> = {
  'england': {
    displayName: 'England',
    description: 'Find the best snorkelling sites in England on our interactive map. GPS coordinates, habitat types, site descriptions and links to find out more.',
  },
  'scotland': {
    displayName: 'Scotland',
    description: 'Find the best snorkelling sites in Scotland on our interactive map. GPS coordinates, habitat types, site descriptions and links to find out more.',
  },
  'wales': {
    displayName: 'Wales',
    description: 'Find the best snorkelling sites in Wales on our interactive map. GPS coordinates, habitat types, site descriptions and links to find out more.',
  },
  'britain': {
    displayName: 'Britain',
    description: 'Discover 100+ snorkelling sites across Britain on our interactive map. GPS coordinates, habitat types, site descriptions and links to find out more.',
  },
  'uk': {
    displayName: 'the UK',
    description: 'Discover 100+ snorkelling sites across the UK on our interactive map. GPS coordinates, habitat types, site descriptions and links to find out more.',
  },
};

async function getNationMapSeoPayload(nation: string): Promise<SeoPayload> {
  const { displayName, description } = NATION_SEO_CONFIG[nation];
  const nationPath = buildMapPath({ country: nation });

  const title = `Snorkelling Sites in ${displayName} | Snorkelology`;
  const keywords = `snorkelling ${displayName}, snorkelling sites ${displayName}, where to snorkel in ${displayName}, best snorkelling ${displayName}, snorkelling map ${displayName}`;

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
    ogImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    twitterImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    schemas: [breadcrumbSchema, nationPlaceSchema, ...collectionSchemas],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getSiteSeoPayload(country: string | null, county: string | null, siteSlug: string): Promise<SeoPayload | null> {
  const place = await getPlaceForSeoByRoute(country, county, siteSlug).catch(() => null);
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
      ? `Snorkelling organisation${locationHint}: ${siteName}. Find guided snorkelling, courses, and snorkel hire on the Snorkelology map of Britain.`
      : `Snorkelling site${locationHint}: ${siteName}. Explore this location on the Snorkelology interactive map of Britain.`);

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
      ? `${siteName} | Snorkelling Organisation | Snorkelology`
      : `${siteName} | Snorkelling Site | Snorkelology`,
    description,
    keywords,
    canonicalPath: sitePath,
    ogType: 'website',
    ogImage: place.image || DEFAULT_SOCIAL_IMAGE,
    twitterImage: place.image || DEFAULT_TWITTER_IMAGE,
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
      showOnMap: { $in: ['Production', 'Development'] },
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
  const canonicalCountry = await getCountrySlugForCounty(county).catch(() => null) ?? country;
  const displayName = getCountyDisplayName(county);
  const countryDisplayName = MAP_COUNTRY_DISPLAY_NAMES[canonicalCountry] ?? toTitleCase(canonicalCountry);
  const countryPath = buildMapPath({ country: canonicalCountry });
  const countyPath = buildMapPath({ country: canonicalCountry, county });
  const extraKeywords = COUNTY_EXTRA_KEYWORDS[county] ?? [];

  const title = `Snorkelling Sites in ${displayName} | Snorkelology`;
  const description = `Find the best snorkelling sites in ${displayName} on our interactive map. GPS coordinates, habitat types, site descriptions and links to find out more.`;
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
    ogImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    twitterImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    schemas: [breadcrumbSchema, countyPlaceSchema, ...collectionSchemas],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getMapSeoPayload(): Promise<SeoPayload> {
  const description = 'Discover 100+ snorkelling sites across Britain on an interactive map. Explore coastal rock pools, kelp forests, sheltered bays, and offshore reefs in England, Scotland, and Wales. Find snorkelling organisations, get GPS coordinates, and filter by habitat type to find your perfect spot.';
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
    image: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
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
    url: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    name: 'Snorkelology interactive snorkelling map of Britain',
    description: 'An interactive map of the best snorkelling sites around the British coastline, created by Snorkelology.',
    representativeOfPage: true,
    contentUrl: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
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
    title: 'Interactive Snorkelling Map of Britain — 100+ Sites | Snorkelology',
    description,
    keywords,
    canonicalPath: '/map',
    ogType: 'website',
    ogImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    twitterImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    schemas: [breadcrumbSchema, mapCreativeWorkSchema, mapImageSchema, ...(mapSchema ? [mapSchema] : [])],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getBlogIndexSeoPayload(): Promise<SeoPayload> {
  const description = 'Browse our collection of British snorkelling articles. Tips on the best places to snorkel in the UK, marine life identification, underwater cameras, gear reviews, and practical safety advice.';
  const keywords = 'snorkelling articles, UK snorkelling, British marine life, snorkelling tips, underwater photography, snorkelling gear';

  const blogListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'British Snorkelling Articles',
    description,
    url: `${SITE_URL}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'Snorkelology',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/banner/snround.webp` }
    }
  };

  return {
    title: 'British Snorkelling Articles — Snorkelology',
    description,
    keywords,
    canonicalPath: '/blog',
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas: [blogListSchema],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getBlogSeoPayload(slug: string): Promise<SeoPayload | null> {
  if (SKIP_SEO_DB_LOOKUPS) {
    return null;
  }

  const post = await getPublishedPostBySlugForSeo(slug);
  if (!post) {
    return null;
  }

  // Fix 1: fall back to stripped intro if subtitle is blank
  const rawDescription = post.subtitle || post.intro || '';
  const description = rawDescription.replace(/<[^>]*>/g, '').slice(0, 300).trim();

  const hasGeneratedOgImage = await generatedOgImageExists(slug);
  const imageUrl = hasGeneratedOgImage
    ? `${SITE_URL}/assets/photos/articles/og/${slug}-og.webp`
    : (post.imgFname ? `${SITE_URL}/assets/${post.imgFname}` : DEFAULT_SOCIAL_IMAGE);

  // Fix 5: use ImageObject instead of plain string
  const imageObject = {
    '@type': 'ImageObject',
    url: imageUrl,
    width: 1200,
    height: 630
  };

  const isFaqType = post.type === 'faq';
  const publishedIso = new Date(post.createdAt || new Date()).toISOString();
  const modifiedIso = new Date(post.updatedAt || post.createdAt || new Date()).toISOString();
  const authorName = post.author || 'Snorkelology';
  const articleUrl = `${SITE_URL}/blog/${slug}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title || 'Article', item: articleUrl }
    ]
  };

  // Fix 4: add url, publisher, mainEntityOfPage; Fix 7: FAQ uses 'article' ogType
  const schema = isFaqType
    ? {
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
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description,
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

  const videoSchemas = (post.sections || [])
    .filter((section: any) => !!section.videoUrl)
    .map((section: any) => ({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: section.title || post.title,
      description: (section.content || description).replace(/<[^>]*>/g, '').slice(0, 300).trim(),
      thumbnailUrl: `https://img.youtube.com/vi/${section.videoUrl}/maxresdefault.jpg`,
      uploadDate: publishedIso,
      embedUrl: `https://www.youtube.com/embed/${section.videoUrl}`,
      contentUrl: `https://www.youtube.com/watch?v=${section.videoUrl}`,
    }));

  // Fix 6: emit keywords as article:tag meta properties
  const keywordTags = (post.keywords || []).map((kw: string) => ({
    key: 'property' as const,
    keyValue: 'article:tag',
    content: kw
  }));

  return {
    title: post.title || 'Snorkelology Blog',
    description,
    keywords: (post.keywords || []).join(', '),
    canonicalPath: `/blog/${slug}`,
    ogType: 'article',  // Fix 7: always 'article' for individual posts
    ogImage: imageUrl,
    twitterImage: imageUrl,  // Fix 2: use article image for Twitter
    schemas: [breadcrumbSchema, schema, ...videoSchemas],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' },
      { key: 'property', keyValue: 'article:published_time', content: publishedIso },
      { key: 'property', keyValue: 'article:modified_time', content: modifiedIso },
      { key: 'property', keyValue: 'article:author', content: authorName },
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


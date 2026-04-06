import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AngularNodeAppEngine, isMainModule, createNodeRequestHandler, writeResponseToNodeResponse } from '@angular/ssr/node';
import mongoose from 'mongoose';
import { shop } from './server-shop';
import { auth } from './server-auth';
import { blog, getPublishedPostBySlugForSeo, getPublishedPostsForSeo } from './server-blog';
import { getPlacesForSeo, getPlaceForSeo, map } from './server-map';
import { injectSeoPayloadIntoHtml, type SeoPayload } from './server-seo-injection';
import { shopItems } from './environments/environment._shopItems';
import { faqItems } from './app/shared/faq-data';
import 'dotenv/config';

const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
const SKIP_SEO_DB_LOOKUPS = process.env['SKIP_SEO_DB_LOOKUPS'] === 'true';
const app = express();
const angularApp = new AngularNodeAppEngine();
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
let mongooseConnectPromise: Promise<void> | null = null;

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
 * Start of API routes
 */
app.get('/api/ping/', (_req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

app.get('/api/db-backup/', (_req, res) => { 
  res.status(201).json({hello: 'world'}); 
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

/**
 * End of API routes
 */

app.use(express.static(browserDistFolder, {maxAge: '1y',index: false,redirect: false,}),);

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

async function injectSeoIntoHtml(pathname: string, query: Record<string, string>, html: string) {
  const payload = await getSeoPayload(pathname, query);
  if (!payload) {
    return html;
  }

  return injectSeoPayloadIntoHtml(html, payload, SITE_URL);
}

async function getSeoPayload(pathname: string, query: Record<string, string> = {}): Promise<SeoPayload | null> {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (normalizedPath === '/' || normalizedPath === '/home') {
    return getHomeSeoPayload();
  }

  if (normalizedPath === '/map') {
    const site = typeof query['site'] === 'string' ? query['site'].trim() : null;
    if (site) {
      return getSiteSeoPayload(site);
    }
    const county = typeof query['county'] === 'string' ? query['county'].toLowerCase().trim() : null;
    if (county) {
      return getCountyMapSeoPayload(county);
    }
    const nation = typeof query['nation'] === 'string' ? query['nation'].toLowerCase().trim() : null;
    if (nation && NATION_SEO_CONFIG[nation]) {
      return getNationMapSeoPayload(nation);
    }
    return getMapSeoPayload();
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

  const blogSchemas = SKIP_SEO_DB_LOOKUPS
    ? []
    : await getPublishedPostsForSeo().then(posts =>
      posts.map((post: any) => ({
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
      }))
    ).catch(() => []);

  const mapPlaces = SKIP_SEO_DB_LOOKUPS
    ? []
    : await getPlacesForSeo().catch((error) => {
      // Keep SSR response resilient, but surface why map JSON-LD was skipped.
      console.error('SEO map schema generation failed:', error);
      return [];
    });
  const mapSchema = mapPlaces.length ? {
    '@context': 'https://schema.org',
    '@graph': mapPlaces
  } : null;

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

  const schemas = [orgSchema, ...productSchemas, ...bookSchemas, faqSchema, ...blogSchemas, mapImageSchema, mapCreativeWorkSchema, homepageVideoSchema, ...(mapSchema ? [mapSchema] : [])];

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

// Counties that are UI aliases of a parent county — the parent is listed first in the display name
const COUNTY_DISPLAY_ALIASES: Record<string, string> = {
  // special combined display names
  'cornwall': 'Cornwall & the Isles of Scilly',
  'highlands': 'The Highlands',
  // user-friendly slug aliases
  'orkney': 'Orkney Islands',
  'anglesey': 'Isle of Anglesey',
  'outer hebrides': 'Outer Hebrides',
  'western isles': 'Outer Hebrides',
  'east yorkshire': 'East Riding of Yorkshire',
  'east riding': 'East Riding of Yorkshire',
  // fix title-case for multi-word DB names used directly as URL params
  'argyll and bute': 'Argyll and Bute',
  'brighton and hove': 'Brighton and Hove',
  'east riding of yorkshire': 'East Riding of Yorkshire',
  'isle of anglesey': 'Isle of Anglesey',
  'isle of wight': 'Isle of Wight',
  'na h-eileanan siar': 'Na h-Eileanan Siar',
  'redcar and cleveland': 'Redcar and Cleveland',
};

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
  const canonicalNation = encodeURIComponent(nation);

  const title = `Snorkelling Sites in ${displayName} | Snorkelology`;
  const keywords = `snorkelling ${displayName}, snorkelling sites ${displayName}, where to snorkel in ${displayName}, best snorkelling ${displayName}, snorkelling map ${displayName}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${SITE_URL}/map` },
      { '@type': 'ListItem', position: 3, name: `Snorkelling in ${displayName}`, item: `${SITE_URL}/map?nation=${canonicalNation}` }
    ]
  };

  return {
    title,
    description,
    keywords,
    canonicalPath: `/map?nation=${canonicalNation}`,
    ogType: 'website',
    ogImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    twitterImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    schemas: [breadcrumbSchema],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}



function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

async function getSiteSeoPayload(siteName: string): Promise<SeoPayload | null> {
  const place = await getPlaceForSeo(siteName).catch(() => null);
  if (!place) return null;

  const canonicalSite = encodeURIComponent(siteName);
  const siteUrl = `${SITE_URL}/map?site=${canonicalSite}`;

  const locationHint = place.district ? ` in ${place.district}` : '';
  const description = place.description
    || `Snorkelling site${locationHint}: ${siteName}. Explore this location on the Snorkelology interactive map of Britain.`;
  const keywords = [
    place.keywords,
    `snorkelling ${siteName}`,
    `${siteName} snorkelling site`
  ].filter(Boolean).join(', ');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${SITE_URL}/map` },
      { '@type': 'ListItem', position: 3, name: siteName, item: siteUrl }
    ]
  };

  const { district: _district, ...placeSchemaFields } = place;
  const placeSchema = {
    '@context': 'https://schema.org',
    ...placeSchemaFields,
    url: siteUrl
  };

  return {
    title: `${siteName} | Snorkelling Site | Snorkelology`,
    description,
    keywords,
    canonicalPath: `/map?site=${canonicalSite}`,
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

async function getCountyMapSeoPayload(county: string): Promise<SeoPayload> {
  const displayName = COUNTY_DISPLAY_ALIASES[county] ?? toTitleCase(county);
  const canonicalCounty = encodeURIComponent(county);

  const title = `Snorkelling Sites in ${displayName} | Snorkelology`;
  const description = `Find the best snorkelling sites in ${displayName} on our interactive map. GPS coordinates, habitat types, site descriptions and links to find out more.`;
  const keywords = `snorkelling ${displayName}, snorkelling sites ${displayName}, where to snorkel in ${displayName}, snorkelling map ${displayName}, best snorkelling ${displayName}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Snorkelling Map of Britain', item: `${SITE_URL}/map` },
      { '@type': 'ListItem', position: 3, name: `Snorkelling in ${displayName}`, item: `${SITE_URL}/map?county=${canonicalCounty}` }
    ]
  };

  return {
    title,
    description,
    keywords,
    canonicalPath: `/map?county=${canonicalCounty}`,
    ogType: 'website',
    ogImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    twitterImage: `${SITE_URL}/assets/snorkelology-unique-snorkel-map-of-britain.jpg`,
    schemas: [breadcrumbSchema],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' }
    ]
  };
}

async function getMapSeoPayload(): Promise<SeoPayload> {
  const description = 'Discover 100+ snorkelling sites across Britain on an interactive map. Explore coastal rock pools, kelp forests, sheltered bays, and offshore reefs in England, Scotland, and Wales. Find snorkelling providers, get GPS coordinates, and filter by habitat type to find your perfect spot.';
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
    'snorkelling providers UK', 'guided snorkelling UK',
    // Brand
    'snorkelology map', 'snorkelology snorkelling map'
  ].join(', ');

  const mapPlaces = SKIP_SEO_DB_LOOKUPS
    ? []
    : await getPlacesForSeo().catch((error) => {
      console.error('SEO map schema generation failed:', error);
      return [];
    });
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
      { '@type': 'Thing', name: 'Snorkelling providers UK' }
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


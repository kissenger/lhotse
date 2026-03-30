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
import { getPlacesForSeo, map } from './server-map';
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
        const withSeo = await injectSeoIntoHtml(req.path, html);
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

async function injectSeoIntoHtml(pathname: string, html: string) {
  const payload = await getSeoPayload(pathname);
  if (!payload) {
    return html;
  }

  return injectSeoPayloadIntoHtml(html, payload, SITE_URL);
}

async function getSeoPayload(pathname: string): Promise<SeoPayload | null> {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (normalizedPath === '/' || normalizedPath === '/home') {
    return getHomeSeoPayload();
  }

  if (normalizedPath.startsWith('/blog/')) {
    const slug = normalizedPath.split('/').filter(Boolean)[1];
    if (!slug) {
      return null;
    }
    return getBlogSeoPayload(slug);
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

  const schemas = [orgSchema, ...productSchemas, faqSchema, ...blogSchemas, ...(mapSchema ? [mapSchema] : [])];

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

async function getBlogSeoPayload(slug: string): Promise<SeoPayload | null> {
  if (SKIP_SEO_DB_LOOKUPS) {
    return null;
  }

  const post = await getPublishedPostBySlugForSeo(slug);
  if (!post) {
    return null;
  }

  const description = `${post.subtitle || ''}`;
  const hasGeneratedOgImage = await generatedOgImageExists(slug);
  const image = hasGeneratedOgImage
    ? `${SITE_URL}/assets/photos/articles/og/${slug}-og.webp`
    : (post.imgFname ? `${SITE_URL}/assets/${post.imgFname}` : DEFAULT_SOCIAL_IMAGE);
  const isFaqType = post.type === 'faq';
  const publishedIso = new Date(post.createdAt || new Date()).toISOString();
  const modifiedIso = new Date(post.updatedAt || post.createdAt || new Date()).toISOString();
  const authorName = post.author || 'Snorkelology';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title || 'Article',
        item: `${SITE_URL}/blog/${slug}`
      }
    ]
  };

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
        description: post.subtitle || post.intro || post.title,
        image,
        datePublished: publishedIso,
        dateModified: modifiedIso,
        author: {
          '@type': 'Person',
          name: authorName
        }
      };

  return {
    title: post.title || 'Snorkelology Blog',
    description,
    keywords: (post.keywords || []).join(', '),
    canonicalPath: `/blog/${slug}`,
    ogType: isFaqType ? 'website' : 'article',
    ogImage: image,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas: [breadcrumbSchema, schema],
    metaTags: [
      { key: 'name', keyValue: 'robots', content: 'index,follow,max-image-preview:large' },
      { key: 'property', keyValue: 'og:site_name', content: 'Snorkelology' },
      { key: 'name', keyValue: 'twitter:site', content: '@snorkelology' },
      { key: 'property', keyValue: 'article:published_time', content: publishedIso },
      { key: 'property', keyValue: 'article:modified_time', content: modifiedIso },
      { key: 'property', keyValue: 'article:author', content: authorName }
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


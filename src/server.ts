import express from 'express';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AngularNodeAppEngine, isMainModule, createNodeRequestHandler, writeResponseToNodeResponse } from '@angular/ssr/node';
import mongoose from 'mongoose';
import { shop } from './server-shop';
import { auth } from './server-auth';
import { blog, getSlugs, getPublishedPostBySlugForSeo, getPublishedPostsForSeo } from './server-blog';
import { getPlacesForSeo, map } from './server-map';
import { injectSeoPayloadIntoHtml, type SeoPayload } from './server-seo-injection';
import { shopItems } from './environments/environment._shopItems';
import { faqItems } from './app/shared/faq-data';
import 'dotenv/config';

// BUILD_DATE variable is written to .env by the build script, and provided to script to write sitemap
const BUILD_DATE = process.env['BUILD_DATE'];
const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
const app = express();
const angularApp = new AngularNodeAppEngine();
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

/**
 * Start of API routes
 */
app.get('/api/ping/', (req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

app.get('/api/db-backup/', (req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

app.use(express.json()); // this is needed to interprete req.body
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

// Only run side effects (DB connection, sitemap generation, listening on a port)
// when this module is executed as the main entry, not when imported for SSR builds.
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  console.log(ENVIRONMENT);
  console.log(BUILD_DATE);

  connectToMongoose();
  generateSitemap(BUILD_DATE);

  const PORT = ENVIRONMENT === 'PRODUCTION' ? 4001 : 4000;
  app.listen(PORT, () => {
    console.log(`Node Express server listening on port ${PORT}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);

/**
 * Function to connect to mongo, and retry if unsuccesful
 * note that once connected, mongoose handles reconnection attempts
 * @returns 
 */
function connectToMongoose()  {
  const MONGODB_PASSWORD = process.env['MONGODB_PASSWORD'];
  const MONGODB_DBNAME = process.env['MONGODB_DBNAME'];
  const MONGODB_CONNECTION_STR = `mongodb+srv://root:${MONGODB_PASSWORD}@cluster0.5h6di.gcp.mongodb.net/${MONGODB_DBNAME}?retryWrites=true&w=majority&appName=Cluster0`;
  return mongoose.connect(MONGODB_CONNECTION_STR).then(
    () => {
      console.log('Mongoose connection successful')
    },
    (error) => {
      console.error('Mongoose failed to connect, retrying...');
      console.error('connection string:');
      console.error(error);
      setTimeout(connectToMongoose, 5000);
    }
  )
}

/**
 * Function to generate a sitemap from the available blog slugs
 * @param buildDate 
 */
async function generateSitemap(buildDate?: string) {
  const slugs = await getSlugs();
  const fname = ENVIRONMENT === 'PRODUCTION' ? 'dist/prod/browser/sitemap.xml' : 'src/config/prod/sitemap.xml';
  const file = createWriteStream(fname);
  const eol = '\r\n'
  const tab = '   ';
  file.on('open', () => {
    file.write(`<?xml version="1.0" encoding="UTF-8"?>${eol}`);
    file.write(`<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">${eol}`);
    file.write(`${tab.repeat(1)}<url>${eol}`);
    file.write(`${tab.repeat(2)}<loc>https://snorkelology.co.uk</loc>${eol}`);
    file.write(`${tab.repeat(2)}<lastmod>${buildDate || new Date().toISOString()}</lastmod>${eol}`);
    file.write(`${tab.repeat(1)}</url>${eol}`);
    slugs.forEach( s => {
      file.write(`${tab.repeat(1)}<url>${eol}`);
      file.write(`${tab.repeat(2)}<loc>https://snorkelology.co.uk/blog/${s.slug}</loc>${eol}`);
      file.write(`${tab.repeat(2)}<lastmod>${s.updatedAt.toISOString()}</lastmod>${eol}`);
      file.write(`${tab.repeat(1)}</url>${eol}`);      
    });
    file.write('</urlset>');
    console.log('Sitemap generated')
  });
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
const DEFAULT_OG_LOGO = `${SITE_URL}/assets/banner/snround.webp`;
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
  const description = 'A website from the authors of Snorkelling Britain. Explore our unique snorkelling map of Britain and buy Snorkelling Britain direct from the authors.';
  const keywords = 'snorkel, snorkeling, snorkelling, snorkelling britain, british snorkelling, underwater photography, sealife, marinelife, snorkelling map, map';
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

  const blogSchemas = await getPublishedPostsForSeo().then(posts =>
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

  const mapPlaces = await getPlacesForSeo().catch(() => []);
  const mapSchema = mapPlaces.length ? {
    '@context': 'https://schema.org',
    '@graph': mapPlaces
  } : null;

  const schemas = [orgSchema, ...productSchemas, faqSchema, ...blogSchemas, ...(mapSchema ? [mapSchema] : [])];

  return {
    title: 'Snorkelology - From the Authors of Snorkelling Britain',
    description,
    keywords,
    canonicalPath: '/',
    ogType: 'website',
    ogImage: DEFAULT_SOCIAL_IMAGE,
    ogLogo: DEFAULT_OG_LOGO,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas
  };
}

async function getBlogSeoPayload(slug: string): Promise<SeoPayload | null> {
  const post = await getPublishedPostBySlugForSeo(slug);
  if (!post) {
    return null;
  }

  const description = `A feature from Snorkelology - ${post.subtitle || ''}`;
  const image = post.imgFname ? `${SITE_URL}/assets/${post.imgFname}` : DEFAULT_SOCIAL_IMAGE;
  const isFaqType = post.type === 'faq';

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
        datePublished: post.createdAt,
        dateModified: post.updatedAt || post.createdAt,
        author: {
          '@type': 'Person',
          name: post.author || 'Snorkelology'
        }
      };

  return {
    title: post.title || 'Snorkelology Blog',
    description,
    keywords: (post.keywords || []).join(', '),
    canonicalPath: `/blog/${slug}`,
    ogType: isFaqType ? 'website' : 'article',
    ogImage: image,
    ogLogo: DEFAULT_OG_LOGO,
    twitterImage: DEFAULT_TWITTER_IMAGE,
    schemas: [schema]
  };
}


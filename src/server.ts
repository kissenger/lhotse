import express from 'express';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AngularNodeAppEngine, isMainModule, createNodeRequestHandler, writeResponseToNodeResponse } from '@angular/ssr/node';
import mongoose from 'mongoose';
import { shop } from './server-shop';
import { auth } from './server-auth';
import { blog, getSlugs } from './server-blog';
import { map } from './server-map';
import 'dotenv/config';

// BUILD_DATE variable is written to .env by the build script, and provided to script to write sitemap
const BUILD_DATE = process.env['BUILD_DATE'];
const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
console.log(ENVIRONMENT);
console.log(BUILD_DATE)
const app = express();
const angularApp = new AngularNodeAppEngine();
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

connectToMongoose();
generateSitemap(BUILD_DATE);

/**
 * Start of API routes
 */
app.get('/api/ping/', (req, res) => { 
  res.status(201).json({hello: 'world'}); 
})

app.use(shop);
app.use(auth);
app.use(blog);
app.use(map);
/**
 * End of API routes
 */

app.use(express.static(browserDistFolder, {maxAge: '1y',index: false,redirect: false,}),);

app.use((req, res, next) => {
  angularApp.handle(req).then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});
console.log(import.meta.url)

if (isMainModule(import.meta.url)) {
  const PORT = ENVIRONMENT === 'PRODUCTION' ? 4001 : 4000;
  app.listen(PORT, () => {
    console.log(`Node Express server listening on http://localhost:${PORT}`);
  });
} else {
  console.log('error')
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
  const MONGODB_CONNECTION_STR = `mongodb+srv://root:${MONGODB_PASSWORD}@cluster0.5h6di.gcp.mongodb.net/${MONGODB_DBNAME}?retryWrites=true&w=majority&appName=Cluster0`
  return mongoose.connect(MONGODB_CONNECTION_STR).then(
    () => {
      console.log('Mongoose connection successful')
    },
    (error) => {
      console.error('Mongoose failed to connect, retrying...')
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
    this.name = "ShopError"
  }
}


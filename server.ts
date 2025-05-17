import express from 'express';
import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
import mongoose from 'mongoose';
import { shop } from './server-shop';
import { auth, verifyToken } from './server-auth';
import { blog, getSlugs } from './server-blog';
import 'dotenv/config';

// if production then use port 4000; for beta and dev use 4000
// prod is snorkelology.co.uk
// dev is beta.snorkelology.co.uk and local development
const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
const PORT = ENVIRONMENT === 'PRODUCTION' ? '4001' : '4000';
const MONGODB_PASSWORD = process.env['MONGODB_PASSWORD'];
const MONGODB_DBNAME = process.env['MONGODB_DBNAME'];
const MONGODB_CONNECTION_STR = `mongodb+srv://root:${MONGODB_PASSWORD}@cluster0.5h6di.gcp.mongodb.net/${MONGODB_DBNAME}?retryWrites=true&w=majority&appName=Cluster0`
const BUILD_DATE = process.env['BUILD_DATE'];

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

mongoose.connect(MONGODB_CONNECTION_STR);
mongoose.connection
  .once('error', () => console.log('xxx'))
  .on('close', () => console.log('MongoDB disconnected'))
  .once('open', () => console.log('MongoDB connected') );

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));

  // update sitemap based on base url and all blog posts
  console.log(`build date = ${BUILD_DATE}`)
  generateSitemap(BUILD_DATE);
  
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');
  const commonEngine = new CommonEngine();
  server.set('view engine', 'html');
  server.set('views', browserDistFolder);
  server.use(express.json());
  server.use(shop);
  server.use(auth);
  server.use(blog);

  server.get('/api/ping/', (req, res) => {
    res.status(201).json({hello: 'world'});
  })

  server.get('/api/secure_ping/', verifyToken, (req, res) => {
    res.status(201).json({hello: 'world'});
  })

// *** End of API Endpoints

  server.get('*.*', express.static(browserDistFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    
    const { protocol, originalUrl, baseUrl, headers } = req;
    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  async function generateSitemap(buildDate?: string) {
  // Create sitemap
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
    });
  }

  return server;
}

function run(): void {
  const port = PORT;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();

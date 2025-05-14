import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
import mongoose from 'mongoose';
import 'dotenv/config';
import BlogModel from '@schema/blog';
import {shop, logShopError} from './server-shop';
import { createWriteStream } from 'node:fs';

// if production then use port 4000; for beta and dev use 4000
// prod is snorkelology.co.uk
// prod is beta.snorkelology.co.uk and local development
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
  server.use(errorHandler);

  server.get('/api/ping/', (req, res) => {
    res.status(201).json({hello: 'world'});
  })

  /* 
    Get all data for all posts
    Returns: Array<BlogPost>
  */
  server.get('/api/blog/get-all-posts/', async (req, res) => {
    try {
      const result = await BlogModel.find({}).sort({"createdAt": "descending"});;
      res.status(201).json(result);
    } catch (error: any) { 
      console.error(error);
      res.status(500).send(error);
    }
  });

    /* 
      Get all data for all posts
      Returns: Array<BlogPost>
    */
    server.get('/api/blog/get-published-posts/', async (req, res) => {
      try {
        const result = await BlogModel.find({isPublished: true}).sort({"createdAt": "descending"});
        res.status(201).json(result);
      } catch (error: any) { 
        console.error(error);
        res.status(500).send(error);
      }
    });

  /* 
    Get post from provided slug
    Returns: BlogPost
  */
  server.get('/api/blog/get-post-by-slug/:slug', async (req, res) => {
    try {
      const listOfSlugs: Array<{slug: string}> = await BlogModel.find({isPublished: true}, {slug: 1}).sort({"createdAt": "descending"});
      const index = listOfSlugs.map(r => r.slug).indexOf(req.params.slug); 
      const lastSlug = listOfSlugs[index-1 < 0 ? listOfSlugs.length-1 : index-1].slug;
      const nextSlug = listOfSlugs[index+1 > listOfSlugs.length-1 ? 0: index+1].slug;
      const article = await BlogModel.findOne({slug: req.params.slug});
      if (article){
        res.status(201).json({article, lastSlug, nextSlug});
      } else {
        // res.status(404).send(new Error('Not Found'));
        throw new Error('Not Found')
      }
    } catch (error: any) {
      res.status(500).send(error);
    }
  });

  server.post('/api/blog/upsert-post/', async (req, res) => {
    try {
      if (req.body._id !=='') {
        await BlogModel.findByIdAndUpdate(req.body._id, req.body);
      } else {
        delete req.body._id;
        delete req.body.createdAt;
        await BlogModel.create(req.body);
      }
      const result = await BlogModel.find({});
      res.status(201).json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).send(error);
    }
  });

  /* 
    Get post specified by _id, and if successful return result of find all
    Returns: Array<BlogPost>
  */
  server.get('/api/blog/delete-post/:_id', async (req, res) => {
    try {
      await BlogModel.deleteOne({_id: req.params._id});
      const result = await BlogModel.find({});
      res.status(201).json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).send(error);
    }
  });



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

  function errorHandler(err: Error, req: any, res: any, next: any) {
    // console.error(err.message)
    console.log('Handling Error:', err);
    if (res.headersSent) {
      return next(err)
    }
    if (err instanceof ShopError) {
       logShopError(req.body.orderNumber, err);
    }
    res.status(500).send({error: err.name, message: err.message});
  }

  async function generateSitemap(buildDate?: string) {
    
  // Create sitemap
    const listOfSlugs = await BlogModel.find({isPublished: true}, {slug: 1, updatedAt: 1}).sort({"createdAt": "descending"});
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
      listOfSlugs.forEach( s => {
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

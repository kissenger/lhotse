import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
import mongoose from 'mongoose';
import 'dotenv/config';
import BlogModel from '@schema/blog';

const PWD = process.env['MONGODB_PASSWORD'];
const DB = process.env['MONGODB_DBNAME'];
// if production then use port 4000; for beta and dev use 4000
const PORT = import.meta.url.match('prod') ? '4001' : '4000';
const CS = `mongodb+srv://root:${PWD}@cluster0.5h6di.gcp.mongodb.net/${DB}?retryWrites=true&w=majority&appName=Cluster0`

mongoose.connect(CS);
mongoose.connection
  .on('error', console.error.bind(console, 'connection error:'))
  .on('close', () => console.log('MongoDB disconnected'))
  .once('open', () => console.log('MongoDB connected') );

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');
  // console.log(serverDistFolder)
  // console.log(browserDistFolder)
  // console.log(indexHtml)

  const commonEngine = new CommonEngine();
  server.set('view engine', 'html');
  server.set('views', browserDistFolder);
   
  server.use(express.json());
  
  server.get('/api/ping/', (req, res) => {
    res.status(201).json({hello: 'world'});
  })

  /* 
    Get all data for all posts
    Returns: Array<BlogPost>
  */
  server.get('/api/get-all-posts/', async (req, res) => {
    try {
      const result = await BlogModel.find({}).sort({"createdAt": "descending"});;
      res.status(201).json(result);
    } catch (error: any) { 
      console.log(error);
      res.status(500).send(error);
    }
  });

    /* 
      Get all data for all posts
      Returns: Array<BlogPost>
    */
    server.get('/api/get-published-posts/', async (req, res) => {
      try {
        const result = await BlogModel.find({isPublished: true}).sort({"createdAt": "descending"});
        res.status(201).json(result);
      } catch (error: any) { 
        console.log(error);
        res.status(500).send(error);
      }
    });

  /* 
    Get post from provided slug
    Returns: BlogPost
  */

  server.get('/api/get-post-by-slug/:slug', async (req, res) => {
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

  server.post('/api/upsert-post/', async (req, res) => {
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
      console.log(error);
      res.status(500).send(error);
    }
  });

  server.get('/api/sitemap/', async (req, res) => {
    // const today = new Date();
    // const todayString = `${today.getFullYear}-${today.getMonth}-${today.getDate}`
    try {
        const listOfSlugs = await BlogModel.find({isPublished: true}, {slug: 1, updatedAt: 1}).sort({"createdAt": "descending"});
        let outString = '&lt;?xml version="1.0" encoding="UTF-8"?&gt;<br />';
        outString += '&lt;urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"&gt;<br />';
        outString += '&nbsp;&nbsp;&nbsp;&lt;url&gt;<br />';
        outString += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;loc>https://snorkelology.co.uk/&lt;/loc&gt;<br />';
        outString += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;lastmod&gt;${new Date().toISOString()}&lt;/lastmod&gt;<br />`;
        outString += '&nbsp;&nbsp;&nbsp;&lt;/url&gt;<br />';
        listOfSlugs.forEach( s => {
          outString += '&nbsp;&nbsp;&nbsp;&lt;url&gt;<br />';
          outString += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;loc>https://snorkelology.co.uk/blog/${s.slug}&lt;/loc&gt;<br />`;
          outString += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;lastmod&gt;${s.updatedAt.toISOString()}&lt;/lastmod&gt;<br />`;
          outString += '&nbsp;&nbsp;&nbsp;&lt;/url&gt;<br />';          
        });
        outString += '&lt;/urlset&gt;';
        res.set('Content-Type', 'text/html');
        res.status(201).send(outString);
        
    } catch (error: any) {
      console.log(error);
      res.status(500).send(error);
    }
  });

  /* 
    Get post specified by _id, and if successful return result of find all
    Returns: Array<BlogPost>
  */
  server.get('/api/delete-post/:_id', async (req, res) => {
    try {
      await BlogModel.deleteOne({_id: req.params._id});
      const result = await BlogModel.find({});
      res.status(201).json(result);
    } catch (error: any) {
      console.log(error);
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
    console.log(`${protocol}://${headers.host}${originalUrl}`)
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

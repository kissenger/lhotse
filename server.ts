import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
import mongoose from 'mongoose';
import 'dotenv/config';
import BlogModel from '@schema/blog';
import ShopModel from '@schema/shop';

// if production then use port 4000; for beta and dev use 4000
const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
const PORT = ENVIRONMENT === 'PRODUCTION' ? '4001' : '4000';
const MONGODB_PASSWORD = process.env['MONGODB_PASSWORD'];
const MONGODB_DBNAME = process.env['MONGODB_DBNAME'];
const MONGODB_CONNECTION_STR = `mongodb+srv://root:${MONGODB_PASSWORD}@cluster0.5h6di.gcp.mongodb.net/${MONGODB_DBNAME}?retryWrites=true&w=majority&appName=Cluster0`
const PAYPAL_CLIENT_ID = process.env['PAYPAL_CLIENT_ID'];
const PAYPAL_CLIENT_SECRET = process.env['PAYPAL_CLIENT_SECRET'];
const PAYPAL_ENDPOINT = ENVIRONMENT === 'PRODUCTION' ? 'https://api-m.paypal.com': 'https://api.sandbox.paypal.com'

mongoose.connect(MONGODB_CONNECTION_STR);
mongoose.connection
  .once('error', () => console.log('xxx'))
  .on('close', () => console.log('MongoDB disconnected'))
  .once('open', () => console.log('MongoDB connected') );

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');
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
  server.get('/api/blog/get-all-posts/', async (req, res) => {
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
    server.get('/api/blog/get-published-posts/', async (req, res) => {
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
      console.log(error);
      res.status(500).send(error);
    }
  });

  
 

  server.get('/api/blog/sitemap/', async (req, res) => {
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
  server.get('/api/blog/delete-post/:_id', async (req, res) => {
    try {
      await BlogModel.deleteOne({_id: req.params._id});
      const result = await BlogModel.find({});
      res.status(201).json(result);
    } catch (error: any) {
      console.log('Error from blog/delete-post' + error);
      res.status(500).send(error);
    }
  });



  /**
   * Creates an order and returns it as a JSON response.
   * @function
   * @name createPaypalOrder
   * @memberof module:routes
   * @param {object} req - The HTTP request object.
   * @param {object} req.body - The request body containing the order information.
   * @param {string} req.body.intent - The intent of the order.
   * @param {object} res - The HTTP response object.
   * @returns {object} The created order as a JSON response.
   * @throws {Error} If there is an error creating the order.
   */
  server.post('/api/shop/create-paypal-order', (req, res) => {

    get_access_token().then(access_token => {
      // console.log(req.body)
      // logShopEvent({intent: req.body, endPoint: PAYPAL_ENDPOINT})
      fetch(PAYPAL_ENDPOINT + '/v2/checkout/orders', { 
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
              },
              body: JSON.stringify(req.body)
          })
          .then(res => res.json())
          .then(json => {
            console.log(json);
            logShopEvent(json.id, {intent: req.body, endPoint: PAYPAL_ENDPOINT})
            res.send(json);
          })
        })
        .catch(err => {
            console.log('Error from shop/create-paypal-order' + err);
            res.status(500).send(err)
        })
  });

  /**
  * Completes an order and returns it as a JSON response.
  * @function
  * @name completeOrder
  * @memberof module:routes
  * @param {object} req - The HTTP request object.
  * @param {object} req.body - The request body containing the order ID and intent.
  * @param {string} req.body.order_id - The ID of the order to complete.
  * @param {string} req.body.intent - The intent of the order.
  * @param {object} res - The HTTP response object.
  * @returns {object} The completed order as a JSON response.
  * @throws {Error} If there is an error completing the order.
  */
  server.post('/api/shop/capture-paypal-payment', (req, res) => {
    get_access_token().then(access_token => {
      console.log(req.body)
      console.log(req.body.orderId)
      console.log(PAYPAL_ENDPOINT)
      console.log(access_token)
      fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.orderId}/capture/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`,
              }
          })
          .then(res => res.json())
          .then(json => {
              console.log(json)
              logShopEvent(json.id, {approved: json})
              res.send(json);
          })
        })

      .catch(err => {
          console.log('Error from shop/capture-paypal-payment' + err);
          logShopEvent(req.body.orderId, {error: err})
          res.status(500).send(err)
      })
  });

  // log shop event to mongodb
  async function logShopEvent(orderNumber: string, orderDetails: any) {
    let response = await ShopModel.findOneAndUpdate(
      {orderNumber: orderNumber}, 
      orderDetails,
      {new: true, upsert: true}
    );
  }

  //PayPal Developer YouTube Video:
  //How to Retrieve an API Access Token (Node.js)
  //https://www.youtube.com/watch?v=HOkkbGSxmp4
  async function get_access_token() {
    const auth = `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    const data = 'grant_type=client_credentials'
    return fetch(PAYPAL_ENDPOINT + '/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(auth).toString('base64')}`
            },
            body: data
        })
        .then(res => res.json())
        .then(json => {
            return json.access_token;
        })
  }

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

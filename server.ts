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
import nodemailer from 'nodemailer';

// if production then use port 4000; for beta and dev use 4000
// prod is snorkelology.co.uk
// prod is beta.snorkelology.co.uk and local development
const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
const PORT = ENVIRONMENT === 'PRODUCTION' ? '4001' : '4000';
const MONGODB_PASSWORD = process.env['MONGODB_PASSWORD'];
const MONGODB_DBNAME = process.env['MONGODB_DBNAME'];
const MONGODB_CONNECTION_STR = `mongodb+srv://root:${MONGODB_PASSWORD}@cluster0.5h6di.gcp.mongodb.net/${MONGODB_DBNAME}?retryWrites=true&w=majority&appName=Cluster0`
const PAYPAL_CLIENT_ID = process.env[ENVIRONMENT === 'PRODUCTION' ? 'PAYPAL_CLIENT_ID': 'PAYPAL_SANDBOX_ID'];
const PAYPAL_CLIENT_SECRET = process.env[ENVIRONMENT === 'PRODUCTION' ? 'PAYPAL_CLIENT_SECRET': 'PAYPAL_SANDBOX_SECRET'];
const PAYPAL_ENDPOINT = ENVIRONMENT === 'PRODUCTION' ? 'https://api-m.paypal.com': 'https://api.sandbox.paypal.com'
const EMAIL_CONFIG = {
  service: 'gmail', 
  host: "stmp.gmail.com",
  port: 587,
  auth: {
    user: 'hello@snorkelology.co.uk',   // your email address
    pass: process.env['GMAIL_APP_PASSWD'] // app password for gordon@snorkelology.co.uk account through google workspace
  },
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

  async function getOrderDetails(orderNumber: string) {
    const order = await ShopModel.findOne({orderNumber});
    console.log(order);
    return {
      orderNumber,
      name: order?.approved.purchase_units[0].shipping.name.full_name,
      address: order?.approved.purchase_units[0].shipping.address,
      email: order?.approved.payer.email_address,
      units: order?.intent.purchase_units[0].items[0].quantity,
      cost: order?.intent.purchase_units[0].amount.breakdown.item_total.value,
      shipping: order?.intent.purchase_units[0].amount.breakdown.shipping.value,
      discount: order?.intent.purchase_units[0].amount.breakdown.discount.value,
      totalCost: order?.intent.purchase_units[0].amount.value,
      api: order?.endPoint
    }
  }


  server.get('/api/shop/get-order-details/:orderNumber', async (req, res) => {
    try {
      let orderDetails = await getOrderDetails(req.params.orderNumber);
      res.status(201).json(orderDetails);
    } catch (error: any) {
      res.status(500).send(error);
    }
  });

  server.post('/api/shop/create-paypal-order', (req, res) => {

    get_access_token().then(token => {

      // token is checked here so that we can store with the intent for max debugging potential
      if (token.error) {

        console.error(token);
        logShopEvent(null, {error: token, intent: req.body, endPoint: PAYPAL_ENDPOINT, orderCreated: Date.now(), errorCreated: Date.now()})
        res.send(token);
      
      } else (

        fetch(PAYPAL_ENDPOINT + '/v2/checkout/orders', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
          body: JSON.stringify(req.body)
        }).then(result => result.json()).then(json => {
          logShopEvent(json.id, {intent: req.body, endPoint: PAYPAL_ENDPOINT, orderCreated: Date.now()})
          res.send(json)
        })
      )

    }).catch(err => {
      console.error(err);
      logShopEvent(null, {error: err, intent: req.body, endPoint: PAYPAL_ENDPOINT, orderCreated: Date.now()})
      res.send(err)
    })
  });


  server.post('/api/shop/patch-paypal-order', (req, res) => {

    get_access_token().then(token => {

      // token is checked here so that we can store with the intent for max debugging potential
      if (token.error) {

        console.error(token);
        logShopEvent(null, {error: token, intent: req.body, endPoint: PAYPAL_ENDPOINT, orderCreated: Date.now(), errorCreated: Date.now()})
        res.send(token);
      
      } else (

        fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.orderNumber}`, { 
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
          body: JSON.stringify([{ 
            "op": "replace", 
            "path": req.body.path, 
            "value": req.body.patch
          }])
        })
        .then(result => {
          logShopEvent(req.body.orderNumber, {patch:req.body, orderPatched: Date.now()})
          res.send(result);
        })
      )

    }).catch(err => {
      console.error(err);
      logShopEvent(req.body.orderNumber, {error: err, intent: req.body, endPoint: PAYPAL_ENDPOINT, orderCreated: Date.now()})
      res.send(err)
    })
  });


  server.post('/api/shop/capture-paypal-payment', (req, res) => {

    get_access_token().then(token => {

      // token is checked here so that we can store with the intent for max debugging potential
      if (token.error) {

        console.error(token);
        logShopEvent(req.body.orderNumber, {error: token, intent: req.body, endPoint: PAYPAL_ENDPOINT, errorCreated: Date.now()})
        res.send(token);

      } else {

        fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.orderNumber}/capture/`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}`}

        }).then(result => result.json()).then(async (json) => {

          if (Array.isArray(json.details)) {
            // error 
            console.error(json.details);
            res.send({error: json.details[0].issue});
            logShopEvent(json.id, {error: json, errorCreated: Date.now()});
          
          } else {
            // success
            await logShopEvent(json.id, {approved: json, orderCompleted: Date.now()})
            let orderDetails = await getOrderDetails(req.body.orderNumber);
            let testMessage = PAYPAL_ENDPOINT.indexOf('sandbox') > 0 ? '<div><b>THIS IS A TEST: NO PAYMENT WAS TAKEN</b></div>' : '';
            let discountMsg = orderDetails.discount > 0 ? `<div class='item'><div class='title'>Discount</div><div>-£${orderDetails.discount.toFixed(2)}</div></div>` : '';
            let emailBody = `
              <head>
                <style>
                  .item { width: 100%; }
                  .item > div{ display: inline-block; vertical-align:top; }
                  .title { width: 20%; }
                </style>
              </head>
              <body>
                ${testMessage}
                <div> 
                  <p>Thank you for your order, we'll do our best to get it to you as soon as possible.</p>
                  <p>If you have any problems with your order, or something doesn't look right below, let us
                  know at <a href="mailto:orders@snorkelology.co.uk">orders@snorkelology.co.uk</a>.</p>
                <div class="item">
                  <div class="title">Order number:</div>
                  <div>${orderDetails.orderNumber}</div>
                </div>
                <div class="item">
                  <div class="title">Shipping:</div>
                  <div>${orderDetails.name}<br>
                  ${orderDetails.address.address_line_1}<br>
                  ${orderDetails.address.admin_area_2}<br>
                  ${orderDetails.address.admin_area_1}<br>
                  ${orderDetails.address.postal_code}<br>
                  ${orderDetails.address.country_code}
                  </div>    
                </div>
                <div class="item">
                  <div class="title">Shipping</div>
                  <div>£${orderDetails.shipping.toFixed(2)}</div>
                </div>
                ${discountMsg}
                <div class="item">
                  <div class="title">Subtotal</div>
                  <div>${orderDetails.totalCost.toFixed(2)}</div>
                </div>                                           
              </body>
              `
              sendEmail(json.payer.email_address, emailBody, 'Your Snorkelology order is on its way!');
              sendEmail(
                'orders@snorkelology.co.uk', 
                `<a href="snorkelology.co.uk/orders">See orders</a></p><br>${emailBody}`, 
                'NEW ORDER'
              );
            
            res.send(json);

          }
        })
      }

    }).catch(err => {
      console.error(err);
      logShopEvent(req.body.orderNumber, {error: err, errorCreated: Date.now()});
      res.status(500).send(err);
    })

  });

  server.post('/api/shop/log-paypal-error', (req, res) => {
    logShopEvent(req.body.orderNumber, {error: req.body.error, errorCreated: Date.now()})
  });

  server.get('/api/shop/get-orders/', async (req, res) => {
    try {
      const result = await ShopModel.find({}).sort({"createdAt": "descending"});;
      res.status(201).json(result);
    } catch (error: any) { 
      console.error(error);
      res.status(500).send(error);
    }
  });



  server.post('/api/shop/set-order-status', async (req, res) => {
    let response = await ShopModel.findOneAndUpdate(
      {orderNumber: req.body.orderNumber}, 
      {[req.body.orderStatus]: Date.now()},
      {new: true, upsert: true}
    );
    res.send(response);
  });

  // log shop event to mongodb
  async function logShopEvent(orderNumber: string | null, orderDetails: any) {
    // create random order number if one doesnt exist (in the case of rejected order creation only)
    orderNumber = orderNumber ?? Math.random().toString().slice(2,9);
    await ShopModel.findOneAndUpdate(
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
        return json;
    })
  }

  function sendEmail(to: string, html: string, subject: string) {

    let transporter = nodemailer.createTransport(EMAIL_CONFIG);
    let message = {
        from: 'noreply@snorkelology.co.uk', 
        to, subject, html
    };
    
    transporter.sendMail(message)
      .then((info) => {
        // console.log(`info:${nodemailer.getTestMessageUrl(info)}`);
      }).catch((err) => {
        console.log(`error:${err}`);
      }
    );
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

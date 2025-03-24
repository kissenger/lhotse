import express from 'express';
import ShopModel from '@schema/shop';
import nodemailer from 'nodemailer';

import 'dotenv/config';

const shop = express();
const ENVIRONMENT = import.meta.url.match('prod') ? "PRODUCTION" : "DEVELOPMENT";
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

/*****************************************************************
 * ROUTE: Create paypal order
 ****************************************************************/
shop.post('/api/shop/create-paypal-order', (req, res) => {

  get_access_token().then(token => {

    // token is checked here so that we can store with the intent for max debugging potential
    if (token.error) {

      console.error(token);
      logShopError(null, token)
      res.send(token);
    
    } else (

      fetch(PAYPAL_ENDPOINT + '/v2/checkout/orders', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
        body: JSON.stringify(req.body)
      }).then(result => result.json()).then(async (json) => {

        let response = await logShopEvent(newOrderNumber(), {
          paypal: {
            id: json.id,
            intent: req.body, 
            endPoint: PAYPAL_ENDPOINT
          }, 
          orderSummary: {
            timeStamps: {
              orderCreated: Date.now()
            }
          }
        })

        res.send({orderNumber: response.orderNumber, paypalOrderId: json.id})
      })
    )

  }).catch(err => {
    console.error(err);
    logShopError(null, err);
    res.send(err)

  })
});

function newOrderNumber() {
  return Date.now().toString();
}

/*****************************************************************
 * ROUTE: Update paypal order
 ****************************************************************/
shop.post('/api/shop/patch-paypal-order', (req, res) => {

  get_access_token().then(token => {

    // token is checked here so that we can store with the intent for max debugging potential
    if (token.error) {
      console.error(token);
      logShopError(req.body.orderNumber, token);
      res.send(token);
    
    } else (

      fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.paypalOrderId}`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
        body: JSON.stringify([{ 
          "op": "replace", 
          "path": req.body.path, 
          "value": req.body.patch
        }])
      })
      .then(result => {

        logShopEvent(req.body.orderNumber, {
          "$set": {
            "paypal.intent.purchase_units": [req.body.patch], 
            "orderSummary.timeStamps.orderPatched": Date.now(),
          }          
        })
        res.send(result);

      })
    )

  }).catch(err => {
    console.error(err);
    logShopError(req.body.orderNumber, err);
    res.send(err)
  })

});

/*****************************************************************
 * ROUTE: Capture paypal payment
 ****************************************************************/

shop.post('/api/shop/capture-paypal-payment', (req, res) => {

  get_access_token().then(token => {

    // token is checked here so that we can store with the intent for max debugging potential
    if (token.error) {

      console.error(token);
      logShopError(req.body.orderNumber, token);
      res.send(token);

    } else {

      fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.paypalOrderId}/capture/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}`}

      }).then(result => result.json()).then(async (json) => {

        if (Array.isArray(json.details)) {
          console.error(json.details);
          res.send({error: json.details[0].issue});
          logShopError(req.body.orderNumber, json)
        
        } else {
          await logShopEvent(req.body.orderNumber, {
            "$set": {
              "paypal.approved": json, 
              "orderSummary.timeStamps.orderCompleted": Date.now(),
            }             
          })

          let orderSummary = await setOrderSummary(req.body.orderNumber);
          let emailBody = getConfirmationEmailBody(orderSummary);
          sendEmail(json.payer.email_address, emailBody, 'Thank you for ordering from Snorkelology');
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

/*****************************************************************
 * ROUTE: Get all orders from database
 ****************************************************************/
shop.get('/api/shop/get-orders/', async (req, res) => {
  try {
    const result = await ShopModel.find({'orderSummary.timeStamps.orderCompleted': {$ne: null}},{orderSummary: 1}).sort({"orderSummary.timeStamp.createdAt": "descending"});
    res.status(201).json(result.map(o=>o.orderSummary));
  } catch (error: any) { 
    console.error(error);
    res.status(500).send(error);
  }
});

/*****************************************************************
 * ROUTE: Get specific order by orderNumber
 ****************************************************************/
shop.get('/api/shop/get-order-details/:orderNumber', async (req, res) => {
  let orderSummary = await getOrderSummary(req.params.orderNumber);
  res.status(201).json(orderSummary);
});

/*****************************************************************
 * ROUTE: Get specific order by orderNumber
 ****************************************************************/
shop.post('/api/shop/set-order-status', async (req, res) => {

  let path =`orderSummary.timeStamps.${req.body.timeStamp}`;
  let result = await logShopEvent(req.body.orderNumber, {
    '$set': {
      [path]: Date.now()
    }
  });
  res.send(result);
  
});

/*****************************************************************
 * ROUTE: Create manual order
 ****************************************************************/
shop.post('/api/shop/create-manual-order', async (req, res) => {

  let order = req.body.order;
  order.timeStamps = {
    orderCreated: Date.now(),
    orderCompleted: Date.now()
  };
  order.orderNumber = newOrderNumber();
  let result = await logShopEvent(order.orderNumber, {orderSummary: order});
  res.send(result);
  
});

/*****************************************************************
 * FUNCTION: Get order summary
 ****************************************************************/
async function getOrderSummary(orderNumber: string) {
  try {
    const order = await ShopModel.findOne({orderNumber}, {'orderSummary': 1});
    return order?.orderSummary;
  } catch (error: any) {
    console.error(error);
    return error;
  }
}

/*****************************************************************
 * FUNCTION: Create order summary
 ****************************************************************/
async function setOrderSummary(orderNumber: string) {
  const order = await ShopModel.findOne({orderNumber});
  let newOrder = await logShopEvent(orderNumber, {
    '$set': {
      'orderSummary.orderNumber': orderNumber,
      'orderSummary.user.name': order?.paypal?.approved.purchase_units[0].shipping.name.full_name,
      'orderSummary.user.address': order?.paypal?.approved.purchase_units[0].shipping.address,
      'orderSummary.user.email_address': order?.paypal?.approved.payer.email_address,
      'orderSummary.items': order?.paypal?.intent.purchase_units[0].items,
      'orderSummary.costBreakdown.items': order?.paypal?.intent.purchase_units[0].amount.breakdown.item_total.value,
      'orderSummary.costBreakdown.shipping': order?.paypal?.intent.purchase_units[0].amount.breakdown.shipping.value,
      'orderSummary.costBreakdown.discount': order?.paypal?.intent.purchase_units[0].amount.breakdown.discount.value,
      'orderSummary.costBreakdown.total': order?.paypal?.intent.purchase_units[0].amount.value,
      'orderSummary.endPoint': order?.paypal?.endPoint,
      'orderSummary.shippingOption': order?.paypal?.approved.purchase_units[0].shipping.options[0].label
    }
  })
  return newOrder.orderSummary; 
}

/*****************************************************************
 * FUNCTION: Create confirmation email content
 ****************************************************************/
function getConfirmationEmailBody(orderSummary: any) {

  let testMessage = orderSummary.endPoint.indexOf('sandbox') > 0 ?
    '<div><b>THIS IS A TEST: NO PAYMENT WAS TAKEN</b></div>' : 
    '';
  let discountMsg = orderSummary.costBreakdown.discount > 0 ? 
    `<div class='item'><div class='title'>Discount</div><div>-£${orderSummary.costBreakdown.discount.toFixed(2)}</div></div>` :
     '';
  return `
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
        <p>Thank you for your order, we'll do our best to get it to you as soon the books are in 
        stock, which are expecting to be early May.</p>
        <p>If you have any problems with your order, or something doesn't look right below, let us
        know at <a href="mailto:orders@snorkelology.co.uk">orders@snorkelology.co.uk</a>.</p>
      <div class="item">
        <div class="title">Order number:</div>
        <div>${orderSummary.orderNumber}</div>
      </div>
      <div class="item">
        <div class="title">Shipping Address:</div>
        <div>${orderSummary.user.name}<br>
        ${orderSummary.user.address.address_line_1}<br>
        ${orderSummary.user.address.admin_area_2}<br>
        ${orderSummary.user.address.admin_area_1}<br>
        ${orderSummary.user.address.postal_code}<br>
        ${orderSummary.user.address.country_code}
        </div>    
      </div>
      <div class="item">
        <div class="title">Shipping Option:</div>
        <div>${orderSummary.shippingOption}</div>    
      </div>                
      <div class="item">
        <div class="title">Item Cost</div>
        <div>£${orderSummary.costBreakdown.items.toFixed(2)}</div>
      </div>                  
      </div>
      <div class="item">
        <div class="title">Shipping</div>
        <div>£${orderSummary.costBreakdown.shipping.toFixed(2)}</div>
      </div>
      ${discountMsg}
      <div class="item">
        <div class="title">Subtotal</div>
        <div>£${orderSummary.costBreakdown.total.toFixed(2)}</div>
      </div>                                           
    </body>
    `
}

/*****************************************************************
 * FUNCTION: Send data to store database
 ****************************************************************/
async function logShopEvent(orderNumber: string | null, orderDetails: any) {
  // create random order number if one doesnt exist (in the case of rejected order creation only)
  orderNumber = orderNumber ?? Math.random().toString().slice(2,9);
  return await ShopModel.findOneAndUpdate(
    {orderNumber: orderNumber},
    orderDetails,
    {new: true, upsert: true}
  );
}

async function logShopError(orderNumber: string | null, error: Object) {
  logShopEvent(orderNumber, { 
    "$set": {
      "paypal.error": error, 
      "orderSummary.timeStamps.errorCreated": Date.now()
    }
  });
}

/*****************************************************************
 * FUNCTION: Get paypal access token
 ****************************************************************/
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

/*****************************************************************
 * FUNCTION: Send email
 ****************************************************************/
  function sendEmail(to: string, html: string, subject: string) {

    let transporter = nodemailer.createTransport(EMAIL_CONFIG);
    let message = {
        from: 'noreply@snorkelology.co.uk', 
        bcc: 'orders@snorkelology.co.uk',
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


  export {shop};
import express from 'express';
import ShopModel from '@schema/shop';
import nodemailer from 'nodemailer';
import 'dotenv/config';
import { ShopError } from 'server';
import {getConfirmationEmailBody} from 'server-confirmation-email';
import {getPostedEmailBody} from 'server-posted-email';
import { ConsoleLogger } from '@paypal/paypal-server-sdk';
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
    user: 'hello@snorkelology.co.uk',
    pass: process.env['GMAIL_APP_PASSWD'] // app password for gordon@snorkelology.co.uk account through google workspace
  },
}


/*****************************************************************
 * ROUTE: Create paypal order
 ****************************************************************/
shop.post('/api/shop/create-paypal-order', async (req, res, next) => {

  try {
    const token = await getAccessToken();
    const orderNumber = req.body.orderNumber ?? newOrderNumber();

    const result = await fetch(PAYPAL_ENDPOINT + '/v2/checkout/orders', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
      body: JSON.stringify(req.body.order.paypal.intent)
    });

    console.log(result);

    // console.log(req.body)
    const json = await result.json();
    if (Array.isArray(json.details)) {
      throw new Error(json.details);
    } else {
      const resp = await logShopEvent( orderNumber, 
        { paypal: { id: json.id, intent: req.body.order.paypal.intent, endPoint: PAYPAL_ENDPOINT}, 
          orderSummary: {...req.body.order.orderSummary, timeStamps: { orderCreated: Date.now() }} 
        });
      res.send({  
        orderNumber: resp.orderNumber, 
        paypalOrderId: json.id
      })
    }

  
  } catch (err: any) {
    logShopError(req.body.orderNumber, err);
    console.log(err);
    res.status(500).send({error: `ShopError: ${err[0].issue.name}`, message: `Error creating PayPal order: ${err[0].issue.message}`});
  }

});

function newOrderNumber() {
  // 13 digit unix epoch giving time in millisecs
  return Date.now().toString();
}

/*****************************************************************
 * ROUTE: Update paypal order
 ****************************************************************/
shop.post('/api/shop/patch-paypal-order', async (req, res) => {
  
  const token = await getAccessToken();

  try {
    const token = await getAccessToken();
    const result = await fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.paypalOrderId}`, { 
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
      body: JSON.stringify([{ 
        "op": "replace", 
        "path": req.body.path, 
        "value": req.body.patch
      }])
    })

    // const json = await result.json();
    // if (Array.isArray(json.details)) {
    //   throw new Error(json.details[0].issue);
    // } else {
      await logShopEvent(req.body.orderNumber, {
        "$set": {
          "paypal.intent.purchase_units": [req.body.patch], 
          "orderSummary.timeStamps.orderPatched": Date.now()
        }          
      })
    // };

    res.send(result);

  } catch (err: any) {
    console.log(err)
    logShopError(req.body.orderNumber, err);
    res.status(500).send({error: `ShopError: ${err.name}`, message: `Error patching PayPal order: ${err.message}`});
  }

})

/*****************************************************************
 * ROUTE: Capture paypal payment
 ****************************************************************/

shop.post('/api/shop/capture-paypal-payment', async (req, res) => {

  try {
    const token = await getAccessToken();

    const result = await fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.paypalOrderId}/capture/`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}`}
    })
      
    const json = await result.json();
    if (Array.isArray(json.details)) {
      throw new Error(json.details[0].issue);
    } else {
      await logShopEvent(req.body.orderNumber, {
        "$set": {
          "paypal.approved": json, 
          "orderSummary.timeStamps.orderCompleted": Date.now(),
        }             
      })
    }

    let orderSummary = await setOrderSummary(req.body.orderNumber);
    let emailBody = getConfirmationEmailBody(orderSummary);
    sendEmail(json.payer.email_address, emailBody, 'Thank you for ordering from Snorkelology');
    res.send(json);

  } catch (err: any) {
    logShopError(req.body.orderNumber, err);
    res.status(500).send({error: `ShopError: ${err.name}`, message: `Error finalising PayPal order: ${err.message}`});
  }

});

/*****************************************************************
 * ROUTE: Get all orders from database
 ****************************************************************/
shop.get('/api/shop/get-orders/:online/:manual/:test/:status/:text', async (req, res) => {

  let filterText: any;
  if (req.params.text!=='null') {
    filterText = {$or: [
        {'orderSummary.user.name': {$regex: req.params.text, $options: 'i'}},
        {'orderSummary.endPoint':  {$regex: req.params.text, $options: 'i'}},
        {'orderNumber':            {$regex: req.params.text, $options: 'i'}},
        {'orderSummary.user.address.postal_code':  {$regex: req.params.text, $options: 'i'}}
      ]}
  }

  let filterStatus: any = {};
  switch (req.params.status) {
    case 'orderCompleted':
      filterStatus = {$and: [
        {'orderSummary.timeStamps.orderCompleted': {$exists: true}}, 
        {'orderSummary.timeStamps.readyToPost': {$exists: false}},
        {'orderSummary.timeStamps.orderCancelled': {$exists: false}}
      ]};
      break;
    case 'readyToPost':
      filterStatus = {$and: [
        {'orderSummary.timeStamps.readyToPost': {$exists: true}}, 
        {'orderSummary.timeStamps.posted': {$exists: false}},
        {'orderSummary.timeStamps.orderCancelled': {$exists: false}}
      ]};
      break;
    case 'posted':
      filterStatus = {$and: [
        {'orderSummary.timeStamps.posted': {$exists: true}}, 
        {'orderSummary.timeStamps.returned': {$exists: false}},
        {'orderSummary.timeStamps.orderCancelled': {$exists: false}}
      ]};
      break;
    case 'returned':
      filterStatus = {$and: [
        {'orderSummary.timeStamps.returned': {$exists: true}}, 
        {'orderSummary.timeStamps.refunded': {$exists: false}},
        {'orderSummary.timeStamps.orderCancelled': {$exists: false}}
      ]};
      break;
    case 'refunded':
      filterStatus = {'orderSummary.timeStamps.refunded': {$exists: true}};
      break;
    case 'orderCancelled':
      filterStatus = {'orderSummary.timeStamps.orderCancelled': {$exists: true}};
      break;
  }
    
  const filterOne = [];
  if (req.params.online==='true') { filterOne.push({'orderSummary.endPoint': 'https://api-m.paypal.com'}) }
  if (req.params.manual==='true') { filterOne.push({'orderSummary.endPoint': 'manual'}) }
  if (req.params.test==='true')   { filterOne.push({'orderSummary.endPoint': 'https://api.sandbox.paypal.com'}) }

  try {

    if (filterOne.length===0 && req.params.text==='null') {
      console.log('returning empty')
      res.status(201).send([]);
    } else {
      const result = await ShopModel.aggregate([{
        $match: {
          $and: [
            {'isActive': {$ne: false}},
            filterText?filterText:{},
            filterStatus,
            filterOne.length>0?{$or: filterOne}:{}
          ]
        }
      }]);
      result.forEach(r=>{
        if (
          (r.orderSummary.timeStamps.orderCompleted && !r.orderSummary.timeStamps.readyToPost && !r.orderSummary.timeStamps.orderCancelled) ||
          (r.orderSummary.timeStamps.readyToPost && !r.orderSummary.timeStamps.posted && !r.orderSummary.timeStamps.orderCancelled) ||
          (r.orderSummary.timeStamps.returned && !r.orderSummary.timeStamps.refunded)
        ) {
          r.orderSummary.isAction = true;
        } else {
          r.orderSummary.isAction = false;
        }

      })
      // console.log(result)
      res.status(201).json(result.map(o=>o.orderSummary));
    }
    
  } catch (error: any) { 
    console.error(error);
    res.status(500).send(error);
  }
});

/*****************************************************************
 * ROUTE: Get specific order by orderNumber
 ****************************************************************/
shop.get('/api/shop/get-order-by-order-number/:orderNumber', async (req, res) => {
  let orderSummary = await getOrderSummary(req.params.orderNumber);
  res.status(201).json(orderSummary);
});

shop.post('/api/shop/add-note', async (req, res) => {
  await addNote(req.body.orderNumber,req.body.note);
  res.status(201).json({respose: 'success'});
});

function addNote(orderNumber: string, newNote: string) {
  return new Promise( async (res,rej) => {
    let orderSummary = await getOrderSummary(orderNumber);
    let response = await logShopEvent(orderNumber, {
      '$set': {
        'orderSummary.notes': `${orderSummary.notes ? orderSummary.notes + '\n' : ''}${(new Date).toISOString()}: ${newNote}`
      }
    });
    res(response);
  })

}


/*****************************************************************
 * ROUTE: Send email to confirm posted
 ****************************************************************/
shop.post('/api/shop/send-posted-email', async (req, res) => {
  console.log('send email')
  let orderSummary = await getOrderSummary(req.body.orderNumber);
  let emailBody = getPostedEmailBody(orderSummary);
  sendEmail(orderSummary.user.email_address, emailBody, 'Your snorkelology order is on its way...');
  await logShopEvent(req.body.orderNumber, { '$set': { 'orderSummary.timeStamps.postedEmailSent': Date.now() } });
  res.status(201).json({respose: 'success'});

});

/*****************************************************************
 * ROUTE: Get specific order by orderNumber
 ****************************************************************/
shop.post('/api/shop/set-order-status', async (req, res) => {
  let setField =`orderSummary.timeStamps.${req.body.set}`;
  await logShopEvent(req.body.orderNumber, {
    '$set': {
      [setField]: Date.now()
    }
  });
  res.status(201).json({respose: 'success'});
})

shop.post('/api/shop/unset-order-status', async (req, res) => {
  let unsetField =`orderSummary.timeStamps.${req.body.unset}`;
  await logShopEvent(req.body.orderNumber, {
    '$unset': {
      [unsetField]: ""
    }
  });
  res.status(201).json({respose: 'success'});
});

/*****************************************************************
 * ROUTE: Create manual order
 ****************************************************************/
shop.post('/api/shop/upsert-manual-order', async (req, res) => {

  let order = req.body.order;
  order.timeStamps = {
    orderCreated: Date.now(),
    orderCompleted: Date.now()
  };

  if (!order.orderNumber) {
    // new order
    order.orderNumber = newOrderNumber();
    order.notes = `${(new Date).toISOString()}: ${order.notes}`;
  } else {
    // not a new order
    let os = await getOrderSummary(order.orderNumber);
    if (order.notes !== '') {
      order.notes = `${os.notes !== '' ? os.notes + '\n' : ''}${(new Date).toISOString()}: ${order.notes}`;
    } else {
      order.notes = os.notes;
    }
  }
  let result = await logShopEvent(order.orderNumber, {orderSummary: order});

  res.send(result);
  
});

shop.post('/api/shop/deactivate-order', async (req, res) => {
  await logShopEvent(req.body.orderNumber, {
    '$set': {
      isActive: false
    }
  });
  res.status(201).json({respose: 'success'});

  
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
      'orderSummary.payPalOrderId': order?.paypal?.id,
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
 * FUNCTION: Send data to store database
 ****************************************************************/
export async function logShopEvent(orderNumber: string | null, orderDetails: any) {
  // create random order number if one doesnt exist (in the case of rejected order creation only)
  orderNumber = orderNumber ?? Math.random().toString().slice(2,9);
  return await ShopModel.findOneAndUpdate(
    {orderNumber: orderNumber},
    orderDetails,
    {new: true, upsert: true}
  );
}

export async function logShopError(orderNumber: string | null, error: Object) {
  logShopEvent(orderNumber, { 
    "$set": {
      "paypal.error": error, 
      "orderSummary.timeStamps.errorCreated": Date.now()
    }
  });
}

  async function getAccessToken() {

    const auth = `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`;
    // const auth = `${PAYPAL_CLIENT_ID}:1234567890`;
    const data = 'grant_type=client_credentials';
    let apiResponse;
    let json;

    try {
      apiResponse = await fetch(PAYPAL_ENDPOINT + '/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(auth).toString('base64')}`
        },
        body: data
      })
      json = await apiResponse.json();
    } catch (error) {
      throw new ShopError('PayPal oauth API: No response recieved');
    }

    if (json.error) {
      throw new ShopError('PayPal oauth API: Authorisation failed');
    }
    
    return json;

  }
// 
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
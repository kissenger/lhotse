import express from 'express';
import ShopModel from '@schema/shop';
import nodemailer from 'nodemailer';
import { ShopError } from 'src/server';
import { getConfirmationEmailBody } from 'src/server-shop-conf-email';
import { getPostedEmailBody } from 'src/server-shop-posted-email';
import { verifyToken } from './server-auth'
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
    user: 'hello@snorkelology.co.uk',
    pass: process.env['GMAIL_APP_PASSWD'] // app password for gordon@snorkelology.co.uk account through google workspace
  },
}

function extractErrorMessage(error: any, fallback: string): string {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (Array.isArray(error)) {
    const first = error[0];
    if (typeof first === 'string') {
      return first;
    }
    if (first?.issue?.message) {
      return first.issue.message;
    }
    if (first?.issue) {
      return String(first.issue);
    }
    if (first?.message) {
      return String(first.message);
    }
  }

  if (error?.details?.[0]?.issue?.message) {
    return error.details[0].issue.message;
  }
  if (error?.details?.[0]?.issue) {
    return String(error.details[0].issue);
  }
  if (error?.message) {
    return String(error.message);
  }

  return fallback;
}

/*****************************************************************
 * ROUTE: Create paypal order
 ****************************************************************/
shop.post('/api/shop/create-paypal-order', async (req, res, _next) => {

  try {
    const token = await getAccessToken();
    const orderNumber = req.body.orderNumber ?? newOrderNumber();

    const result = await fetch(PAYPAL_ENDPOINT + '/v2/checkout/orders', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
      body: JSON.stringify(req.body.order.paypal.intent)
    });

    const json = await result.json();
    if (!result.ok || Array.isArray(json.details)) {
      throw json;
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
    await logShopError(req.body.orderNumber, err);
    const message = extractErrorMessage(err, 'Unknown PayPal order creation error');
    res.status(500).send({error: 'ShopError', message: `Error creating PayPal order: ${message}`});
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

    await logShopEvent(req.body.orderNumber, {
        "$set": {
          "paypal.intent.purchase_units": [req.body.patch], 
          "orderSummary.timeStamps.orderPatched": Date.now()
        }          
      })

    res.send(result);

  } catch (err: any) {
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
    if (!result.ok || Array.isArray(json.details)) {
      throw json;
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
    const payerEmail = json.payer?.email_address;
    if (payerEmail) {
      sendEmail(payerEmail, emailBody, 'Thank you for ordering from Snorkelology');
    }
    res.send(json);

  } catch (err: any) {
    await logShopError(req.body.orderNumber, err);
    const message = extractErrorMessage(err, 'Unknown PayPal capture error');
    res.status(500).send({error: 'ShopError', message: `Error finalising PayPal order: ${message}`});
  }

});

/*****************************************************************
 * ROUTE: Get all orders from database
 ****************************************************************/
shop.get('/api/shop/get-orders/:online/:manual/:test/:status/:text', verifyToken, async (req, res) => {

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

shop.post('/api/shop/add-note', verifyToken, async (req, res) => {
  await addNote(req.body.orderNumber,req.body.note);
  res.status(201).json({respose: 'success'});
});

function addNote(orderNumber: string, newNote: string) {
  return new Promise( async (res,_rej) => {
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
shop.post('/api/shop/send-posted-email', verifyToken, async (req, res) => {
  let orderSummary = await getOrderSummary(req.body.orderNumber);
  let emailBody = getPostedEmailBody(orderSummary);
  sendEmail(orderSummary.user.email_address, emailBody, 'Your snorkelology order is on its way...');
  await logShopEvent(req.body.orderNumber, { '$set': { 'orderSummary.timeStamps.postedEmailSent': Date.now() } });
  res.status(201).json({respose: 'success'});

});

/*****************************************************************
 * ROUTE: Get specific order by orderNumber
 ****************************************************************/
shop.post('/api/shop/set-order-status', verifyToken, async (req, res) => {
  let setField =`orderSummary.timeStamps.${req.body.set}`;
  await logShopEvent(req.body.orderNumber, {
    '$set': {
      [setField]: Date.now()
    }
  });
  res.status(201).json({respose: 'success'});
})

shop.post('/api/shop/unset-order-status', verifyToken, async (req, res) => {
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
shop.post('/api/shop/upsert-manual-order', verifyToken, async (req, res) => {

  let order = req.body.order;

  if (!order.orderNumber) {
    // new order
    order.timeStamps = {
      orderCreated: Date.now(),
      orderCompleted: Date.now()
    };
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
    order.timeStamps = {edited: Date.now(), ...os.timeStamps};
  }
  
  let result = await logShopEvent(order.orderNumber, {orderSummary: order});

  res.send(result);
  
});

shop.post('/api/shop/deactivate-order', verifyToken, async (req, res) => {
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
  try {
    const order = await ShopModel.findOne({orderNumber});
    const approved = order?.paypal?.approved;
    const intent = order?.paypal?.intent;

    const approvedPurchaseUnit = approved?.purchase_units?.[0];
    const intentPurchaseUnit = intent?.purchase_units?.[0];
    const shipping = approvedPurchaseUnit?.shipping;
    const payer = approved?.payer;
    const amount = intentPurchaseUnit?.amount;
    const breakdown = amount?.breakdown;

    const setFields: Record<string, any> = {
      'orderSummary.orderNumber': orderNumber
    };

    const fullName = shipping?.name?.full_name;
    const fallbackName = [payer?.name?.given_name, payer?.name?.surname].filter(Boolean).join(' ').trim();
    const userName = fullName || fallbackName;

    if (order?.paypal?.id !== undefined) setFields['orderSummary.payPalOrderId'] = order.paypal.id;
    if (userName) setFields['orderSummary.user.name'] = userName;
    if (shipping?.address !== undefined) setFields['orderSummary.user.address'] = shipping.address;
    if (payer?.email_address) setFields['orderSummary.user.email_address'] = payer.email_address;
    if (intentPurchaseUnit?.items !== undefined) setFields['orderSummary.items'] = intentPurchaseUnit.items;
    if (breakdown?.item_total?.value !== undefined) setFields['orderSummary.costBreakdown.items'] = breakdown.item_total.value;
    if (breakdown?.shipping?.value !== undefined) setFields['orderSummary.costBreakdown.shipping'] = breakdown.shipping.value;
    if (breakdown?.discount?.value !== undefined) setFields['orderSummary.costBreakdown.discount'] = breakdown.discount.value;
    if (amount?.value !== undefined) setFields['orderSummary.costBreakdown.total'] = amount.value;
    if (order?.paypal?.endPoint !== undefined) setFields['orderSummary.endPoint'] = order.paypal.endPoint;

    const selectedShipping = shipping?.options?.find((o: any) => o?.selected) ?? shipping?.options?.[0];
    if (selectedShipping?.label) setFields['orderSummary.shippingOption'] = selectedShipping.label;

    const newOrder = await logShopEvent(orderNumber, {
      '$set': setFields
    });

    return newOrder.orderSummary;
  } catch (error) {
    console.error(error);
    const fallbackOrder = await ShopModel.findOne({orderNumber}, {'orderSummary': 1});
    return fallbackOrder?.orderSummary ?? { orderNumber };
  }
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
  try {
    await logShopEvent(orderNumber, {
      "$set": {
        "paypal.error": error,
        "orderSummary.timeStamps.errorCreated": Date.now()
      }
    });
  } catch (logError) {
    console.error('Failed to persist shop error to database', logError);
  }
}

async function getAccessToken() {

  const auth = `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`;
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
    .then((_info) => {
    }).catch((err) => {
      console.error(`sendMail error: ${err}`);
    }
  );
}

export {shop};
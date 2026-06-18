import express from 'express';
import rateLimit from 'express-rate-limit';
import ShopModel from '@schema/shop';
import nodemailer from 'nodemailer';
import { ShopError } from './server';
import { getConfirmationEmailBody } from './server-shop-conf-email';
import { getPostedEmailBody } from './server-shop-posted-email';
import { requireAdmin, verifyToken } from './server-auth'
import { shippingOptions as shippingOptionsConfig } from './environments/environment._shippingOptions';
import { shopItems as shopItemsConfig } from './environments/environment._shopItems';
import { environment } from './environments/environment';
import 'dotenv/config';

const checkoutRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'ShopError', message: 'Too many requests. Please try again later.' },
});

const shop = express();
const ENVIRONMENT = environment.STAGE === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT';
const PAYPAL_ENDPOINT = ENVIRONMENT === 'PRODUCTION' ? 'https://api-m.paypal.com': 'https://api.sandbox.paypal.com'
const STOCK_ITEMS = shopItemsConfig.SHOP_ITEMS;
const SHIPPING_OPTIONS = shippingOptionsConfig.SHIPPING_OPTIONS;
const EMAIL_CONFIG = {
  service: 'gmail', 
  host: "stmp.gmail.com",
  port: 587,
  auth: {
    user: 'hello@snorkelology.co.uk',
    pass: process.env['GMAIL_APP_PASSWD'] // app password for gordon@snorkelology.co.uk account through google workspace
  },
}
const PAYPAL_ALERT_RECIPIENT = process.env['PAYPAL_ALERT_EMAIL_TO'] || 'orders@snorkelology.co.uk';

function toErrorText(error: unknown): string {
  try {
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function notifyPayPalApiError(context: {
  route: string;
  orderNumber?: string | null;
  endpoint?: string;
  status?: number;
  method?: string;
  error: unknown;
}): void {
  const envLabel = ENVIRONMENT === 'PRODUCTION' ? 'prod' : 'non-prod';
  const subject = `[${envLabel}] PayPal API error: ${context.route}`;
  const html = `
    <h2>PayPal API error alert</h2>
    <p><strong>Environment:</strong> ${envLabel}</p>
    <p><strong>Route:</strong> ${context.route}</p>
    <p><strong>Order Number:</strong> ${context.orderNumber ?? 'n/a'}</p>
    <p><strong>Method:</strong> ${context.method ?? 'n/a'}</p>
    <p><strong>Endpoint:</strong> ${context.endpoint ?? PAYPAL_ENDPOINT}</p>
    <p><strong>Status:</strong> ${context.status ?? 'n/a'}</p>
    <h3>Error</h3>
    <pre>${truncateText(toErrorText(context.error), 12000)}</pre>
  `;

  sendEmail(PAYPAL_ALERT_RECIPIENT, html, subject);
}

function roundToCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPositiveQuantity(value: unknown): number {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.max(0, Math.floor(quantity));
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeShippingContext(items: Array<{ id: string; quantity: number }>, selectedShippingLabel?: string) {
  const itemLookup = new Map(STOCK_ITEMS.map((item) => [item.id, item]));
  const trustedItems = items
    .map((entry) => ({ item: itemLookup.get(entry.id), quantity: entry.quantity }))
    .filter((entry): entry is { item: (typeof STOCK_ITEMS)[number]; quantity: number } => !!entry.item && entry.quantity > 0)
    .map(({ item, quantity }) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      unit_amount: {
        currency_code: 'GBP',
        value: roundToCurrency(Number(item.unit_amount.value)),
      },
      quantity,
      weightInGrams: item.weightInGrams,
      thickness: item.dimensions.thickness,
    }));

  if (!trustedItems.length) {
    throw new ShopError('No valid items in order');
  }

  const totalWeight = trustedItems.reduce((sum, item) => sum + item.weightInGrams * item.quantity, 0);
  const totalThickness = trustedItems.reduce((sum, item) => sum + item.thickness * item.quantity, 0);

  const parcel = SHIPPING_OPTIONS.find((option) =>
    (option.maxWeight - option.packaging.weight > totalWeight) &&
    (option.maxDimensions.thickness > totalThickness)
  ) ?? SHIPPING_OPTIONS[SHIPPING_OPTIONS.length - 1];

  if (!parcel || !parcel.services?.length) {
    throw new ShopError('No shipping services are available for this basket');
  }

  const selectedService = parcel.services.find((service) => service.label === selectedShippingLabel) ?? parcel.services[0];
  const shippingCost = roundToCurrency(Number(selectedService.cost));
  const itemsCost = roundToCurrency(
    trustedItems.reduce((sum, item) => sum + item.unit_amount.value * item.quantity, 0)
  );

  return {
    trustedItems,
    selectedService,
    itemsCost,
    shippingCost,
    paypalShippingOptions: parcel.services.map((service, index) => ({
      id: service.label,
      label: service.label,
      selected: selectedService.label ? service.label === selectedService.label : index === 0,
      type: 'SHIPPING',
      amount: {
        currency_code: 'GBP',
        value: roundToCurrency(Number(service.cost)),
      },
    })),
  };
}

function buildTrustedCreatePayload(order: any) {
  const rawItems = Array.isArray(order?.orderSummary?.items) ? order.orderSummary.items : [];
  const requestedItems = rawItems.map((item: any) => ({
    id: String(item?.id ?? ''),
    quantity: toPositiveQuantity(item?.quantity),
  }));
  const selectedShippingLabel = typeof order?.orderSummary?.shippingOption === 'string'
    ? order.orderSummary.shippingOption
    : undefined;
  const discountPercentRaw = Number(order?.orderSummary?.discountInfo?.discountPercent ?? 0);
  const discountPercent = Number.isFinite(discountPercentRaw)
    ? Math.max(0, Math.min(100, discountPercentRaw))
    : 0;

  const { trustedItems, selectedService, itemsCost, shippingCost, paypalShippingOptions } = computeShippingContext(requestedItems, selectedShippingLabel);
  const discountValue = Math.trunc(Math.round(-itemsCost * 100) * discountPercent / 100) / 100;
  const totalCost = roundToCurrency(itemsCost + shippingCost + discountValue);

  return {
    orderSummaryPatch: {
      items: trustedItems.map(({ weightInGrams: _weightInGrams, thickness: _thickness, ...item }) => item),
      shippingOption: selectedService.label,
      costBreakdown: {
        items: itemsCost,
        shipping: shippingCost,
        discount: discountValue,
        total: totalCost,
      },
      discountInfo: {
        discountCode: order?.orderSummary?.discountInfo?.discountCode ?? '',
        discountPercent,
        discountValue,
      },
    },
    paypalIntent: {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'GBP',
          value: totalCost,
          breakdown: {
            item_total: { currency_code: 'GBP', value: itemsCost },
            shipping: { currency_code: 'GBP', value: shippingCost },
            discount: { currency_code: 'GBP', value: discountValue },
          },
        },
        items: trustedItems.map(({ weightInGrams: _weightInGrams, thickness: _thickness, ...item }) => item),
        shipping: {
          options: paypalShippingOptions,
        },
      }],
    },
  };
}

function buildTrustedPatchPurchaseUnit(patch: any) {
  const rawItems = Array.isArray(patch?.items) ? patch.items : [];
  const selectedShippingLabel = Array.isArray(patch?.shipping?.options)
    ? patch.shipping.options.find((option: any) => option?.selected)?.label
    : undefined;
  const requestedItems = rawItems.map((item: any) => ({
    id: String(item?.id ?? ''),
    quantity: toPositiveQuantity(item?.quantity),
  }));
  const { trustedItems, selectedService, itemsCost, shippingCost, paypalShippingOptions } = computeShippingContext(requestedItems, selectedShippingLabel);
  const totalCost = roundToCurrency(itemsCost + shippingCost);

  return {
    trustedPurchaseUnit: {
      amount: {
        currency_code: 'GBP',
        value: totalCost,
        breakdown: {
          item_total: { currency_code: 'GBP', value: itemsCost },
          shipping: { currency_code: 'GBP', value: shippingCost },
          discount: { currency_code: 'GBP', value: 0 },
        },
      },
      items: trustedItems.map(({ weightInGrams: _weightInGrams, thickness: _thickness, ...item }) => item),
      shipping: {
        options: paypalShippingOptions,
      },
    },
    orderSummaryPatch: {
      items: trustedItems.map(({ weightInGrams: _weightInGrams, thickness: _thickness, ...item }) => item),
      shippingOption: selectedService.label,
      costBreakdown: {
        items: itemsCost,
        shipping: shippingCost,
        discount: 0,
        total: totalCost,
      },
      discountInfo: {
        discountCode: '',
        discountPercent: 0,
        discountValue: 0,
      },
    },
  };
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

function appendTimestampedNote(existingNotes: string, note: string): string {
  return `${existingNotes ? `${existingNotes}\n` : ''}${(new Date()).toISOString()}: ${note}`;
}

/*****************************************************************
 * ROUTE: Create paypal order
 ****************************************************************/
shop.post('/api/shop/create-paypal-order', checkoutRateLimit, async (req, res, _next) => {

  try {
    const token = await getAccessToken();
    const { paypalIntent, orderSummaryPatch } = buildTrustedCreatePayload(req.body?.order);
    const orderNumber = req.body.orderNumber ?? newOrderNumber();

    const result = await fetch(PAYPAL_ENDPOINT + '/v2/checkout/orders', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
      body: JSON.stringify(paypalIntent)
    });

    const json = await result.json();
    if (!result.ok || Array.isArray(json.details)) {
      throw { ...json, __paypalStatus: result.status };
    } else {
      const resp = await logShopEvent( orderNumber, 
        { paypal: { id: json.id, intent: paypalIntent, endPoint: PAYPAL_ENDPOINT}, 
          orderSummary: {
            ...(req.body?.order?.orderSummary ?? {}),
            ...orderSummaryPatch,
            endPoint: PAYPAL_ENDPOINT,
            timeStamps: { orderCreated: Date.now() }
          }
        });
      res.send({  
        orderNumber: resp.orderNumber, 
        paypalOrderId: json.id
      })
    }

  } catch (err: any) {
    await logShopError(req.body.orderNumber, err);
    notifyPayPalApiError({
      route: '/api/shop/create-paypal-order',
      orderNumber: req.body?.orderNumber ?? null,
      method: 'POST',
      endpoint: `${PAYPAL_ENDPOINT}/v2/checkout/orders`,
      status: err?.__paypalStatus,
      error: err,
    });
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
shop.post('/api/shop/patch-paypal-order', checkoutRateLimit, async (req, res) => {
  
  try {
    // Only allow patching purchase_units (the only valid use during checkout)
    if (typeof req.body.path !== 'string' || !req.body.path.startsWith('/purchase_units/')) {
      res.status(400).json({ error: 'ShopError', message: 'Invalid patch path' });
      return;
    }

    const token = await getAccessToken();
    const { trustedPurchaseUnit, orderSummaryPatch } = buildTrustedPatchPurchaseUnit(req.body?.patch);
    const result = await fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.paypalOrderId}`, { 
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token.access_token}`},
      body: JSON.stringify([{ 
        "op": "replace", 
        "path": req.body.path, 
        "value": trustedPurchaseUnit
      }])
    })

    if (!result.ok) {
      let details: any = null;
      try {
        details = await result.json();
      } catch {
        details = { message: await result.text() };
      }
      throw {
        name: 'ShopError',
        message: `PayPal patch failed (${result.status})`,
        details,
        __paypalStatus: result.status,
      };
    }

    await logShopEvent(req.body.orderNumber, {
        "$set": {
          "paypal.intent.purchase_units": [trustedPurchaseUnit],
          "orderSummary.items": orderSummaryPatch.items,
          "orderSummary.shippingOption": orderSummaryPatch.shippingOption,
          "orderSummary.costBreakdown": orderSummaryPatch.costBreakdown,
          "orderSummary.discountInfo": orderSummaryPatch.discountInfo,
          "orderSummary.timeStamps.orderPatched": Date.now()
        }          
      })

    res.send({ ok: true });

  } catch (err: any) {
    await logShopError(req.body.orderNumber, err);
    notifyPayPalApiError({
      route: '/api/shop/patch-paypal-order',
      orderNumber: req.body?.orderNumber ?? null,
      method: 'PATCH',
      endpoint: `${PAYPAL_ENDPOINT}/v2/checkout/orders/${req.body?.paypalOrderId ?? 'unknown'}`,
      status: err?.__paypalStatus,
      error: err,
    });
    res.status(500).send({error: `ShopError: ${err.name}`, message: `Error patching PayPal order: ${err.message}`});
  }

})

/*****************************************************************
 * ROUTE: Capture paypal payment
 ****************************************************************/

shop.post('/api/shop/capture-paypal-payment', checkoutRateLimit, async (req, res) => {

  try {
    const token = await getAccessToken();

    const result = await fetch(PAYPAL_ENDPOINT + `/v2/checkout/orders/${req.body.paypalOrderId}/capture/`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}`}
    })
      
    const json = await result.json();
    if (!result.ok || Array.isArray(json.details)) {
      throw { ...json, __paypalStatus: result.status };
    } else {
      // Validate shipping country before treating the capture as successful
      const shippingCountry = json.purchase_units?.[0]?.shipping?.address?.country_code;
      if (shippingCountry && shippingCountry !== 'GB') {
        // Log the attempt then reject — do not fulfil non-UK orders
        await logShopError(req.body.orderNumber, { issue: `Non-UK shipping address rejected at capture: ${shippingCountry}` });
        res.status(400).send({ error: 'COUNTRY_NOT_SUPPORTED', message: 'We only ship within the UK. Please place a new order with a UK delivery address.' });
        return;
      }
      await logShopEvent(req.body.orderNumber, {
        "$set": {
          "paypal.approved": json, 
          "orderSummary.timeStamps.orderCompleted": Date.now(),
        }             
      })
    }

    let orderSummary = await setOrderSummary(req.body.orderNumber);
    res.send(json);

    // Send confirmation email after responding — failure must not affect the payment result
    try {
      let emailBody = getConfirmationEmailBody(orderSummary);
      const payerEmail = json.payer?.email_address;
      if (payerEmail) {
        await sendEmail(payerEmail, emailBody, 'Thank you for ordering from Snorkelology');
      }
    } catch (emailErr) {
    }

  } catch (err: any) {
    await logShopError(req.body.orderNumber, err);
    notifyPayPalApiError({
      route: '/api/shop/capture-paypal-payment',
      orderNumber: req.body?.orderNumber ?? null,
      method: 'POST',
      endpoint: `${PAYPAL_ENDPOINT}/v2/checkout/orders/${req.body?.paypalOrderId ?? 'unknown'}/capture/`,
      status: err?.__paypalStatus,
      error: err,
    });
    const message = extractErrorMessage(err, 'Unknown PayPal capture error');
    res.status(500).send({error: 'ShopError', message: `Error finalising PayPal order: ${message}`});
  }

});

/*****************************************************************
 * ROUTE: Get all orders from database
 ****************************************************************/
shop.get('/api/shop/get-orders/:online/:manual/:test/:status/:text', verifyToken, requireAdmin, async (req, res) => {

  let filterText: any;
  if (req.params.text!=='null') {
    const escapedText = escapeRegex(req.params.text);
    filterText = {$or: [
        {'orderSummary.user.name': {$regex: escapedText, $options: 'i'}},
        {'orderSummary.endPoint':  {$regex: escapedText, $options: 'i'}},
        {'orderNumber':            {$regex: escapedText, $options: 'i'}},
        {'orderSummary.user.address.postal_code':  {$regex: escapedText, $options: 'i'}}
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
    res.status(500).send(error);
  }
});

/*****************************************************************
 * ROUTE: Get specific order by orderNumber
 ****************************************************************/
shop.get('/api/shop/get-order-by-order-number/:orderNumber', verifyToken, requireAdmin, async (req, res) => {
  let orderSummary = await getOrderSummary(req.params.orderNumber);
  res.status(201).json(orderSummary);
});

shop.post('/api/shop/add-note', verifyToken, requireAdmin, async (req, res) => {
  await addNote(req.body.orderNumber,req.body.note);
  res.status(201).json({respose: 'success'});
});

async function addNote(orderNumber: string, newNote: string) {
  const orderSummary = await getOrderSummary(orderNumber);
  return logShopEvent(orderNumber, {
    '$set': {
      'orderSummary.notes': appendTimestampedNote(orderSummary?.notes ?? '', newNote)
    }
  });
}


/*****************************************************************
 * ROUTE: Send email to confirm posted
 ****************************************************************/
shop.post('/api/shop/send-posted-email', verifyToken, requireAdmin, async (req, res) => {
  let orderSummary = await getOrderSummary(req.body.orderNumber);
  let emailBody = getPostedEmailBody(orderSummary);
  sendEmail(orderSummary.user.email_address, emailBody, 'Your snorkelology order is on its way...');
  await logShopEvent(req.body.orderNumber, { '$set': { 'orderSummary.timeStamps.postedEmailSent': Date.now() } });
  res.status(201).json({respose: 'success'});

});

const VALID_ORDER_STATUSES = new Set([
  'orderCreated', 'orderCompleted', 'readyToPost', 'posted',
  'returned', 'refunded', 'postedEmailSent', 'orderCancelled', 'invoiced', 'invoicePaid'
]);

function sendInvalidOrderStatus(res: express.Response): void {
  res.status(400).json({ error: 'ShopError', message: 'Invalid order status field' });
}

async function applyOrderStatusMutation(orderNumber: string, status: string, mode: 'set' | 'unset'): Promise<void> {
  const field = `orderSummary.timeStamps.${status}`;
  const update = mode === 'set'
    ? { '$set': { [field]: Date.now() } }
    : { '$unset': { [field]: '' } };

  await logShopEvent(orderNumber, update);
}

/*****************************************************************
 * ROUTE: Get specific order by orderNumber
 ****************************************************************/
shop.post('/api/shop/set-order-status', verifyToken, requireAdmin, async (req, res) => {
  const status = req.body.set;
  if (!VALID_ORDER_STATUSES.has(status)) {
    sendInvalidOrderStatus(res);
    return;
  }
  await applyOrderStatusMutation(req.body.orderNumber, status, 'set');
  res.status(201).json({respose: 'success'});
})

shop.post('/api/shop/unset-order-status', verifyToken, requireAdmin, async (req, res) => {
  const status = req.body.unset;
  if (!VALID_ORDER_STATUSES.has(status)) {
    sendInvalidOrderStatus(res);
    return;
  }
  await applyOrderStatusMutation(req.body.orderNumber, status, 'unset');
  res.status(201).json({respose: 'success'});
});

/*****************************************************************
 * ROUTE: Create manual order
 ****************************************************************/
shop.post('/api/shop/upsert-manual-order', verifyToken, requireAdmin, async (req, res) => {

  let order = req.body.order;

  if (!order.orderNumber) {
    // new order
    order.timeStamps = {
      orderCreated: Date.now(),
      orderCompleted: Date.now()
    };
    order.orderNumber = newOrderNumber();
    order.notes = appendTimestampedNote('', order.notes);
  } else {
    // not a new order
    let os = await getOrderSummary(order.orderNumber);
    if (order.notes !== '') {
      order.notes = appendTimestampedNote(os?.notes ?? '', order.notes);
    } else {
      order.notes = os.notes;
    }
    order.timeStamps = {edited: Date.now(), ...os.timeStamps};
  }
  
  let result = await logShopEvent(order.orderNumber, {orderSummary: order});

  res.send(result);
  
});

shop.post('/api/shop/deactivate-order', verifyToken, requireAdmin, async (req, res) => {
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
    const fallbackOrder = await ShopModel.findOne({orderNumber}, {'orderSummary': 1});
    return fallbackOrder?.orderSummary ?? { orderNumber };
  }
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
  try {
    await logShopEvent(orderNumber, {
      "$set": {
        "paypal.error": error,
        "orderSummary.timeStamps.errorCreated": Date.now()
      }
    });
  } catch (logError) {
  }
}

async function getAccessToken() {

  const clientId = process.env[ENVIRONMENT === 'PRODUCTION' ? 'PAYPAL_CLIENT_ID' : 'PAYPAL_SANDBOX_ID'];
  const clientSecret = process.env[ENVIRONMENT === 'PRODUCTION' ? 'PAYPAL_CLIENT_SECRET' : 'PAYPAL_SANDBOX_SECRET'];
  const auth = `${clientId}:${clientSecret}`;
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
    notifyPayPalApiError({
      route: 'getAccessToken',
      method: 'POST',
      endpoint: `${PAYPAL_ENDPOINT}/v1/oauth2/token`,
      error,
    });
    throw new ShopError('PayPal oauth API: No response recieved');
  }

  if (json.error) {
    notifyPayPalApiError({
      route: 'getAccessToken',
      method: 'POST',
      endpoint: `${PAYPAL_ENDPOINT}/v1/oauth2/token`,
      status: apiResponse.status,
      error: json,
    });
    throw new ShopError(`PayPal oauth API: Authorisation failed (${json.error}: ${json.error_description})`);
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
    }).catch((_err) => {
    }
  );
}

export {shop};
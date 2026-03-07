#!/usr/bin/env node
import 'dotenv/config';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:4000';
const RUN_CAPTURE = process.env.PAYPAL_BACKEND_RUN_CAPTURE === 'true';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildOrderPayload() {
  const purchaseUnit = {
    amount: {
      currency_code: 'GBP',
      value: '1.00',
      breakdown: {
        item_total: { currency_code: 'GBP', value: '1.00' },
        shipping: { currency_code: 'GBP', value: '0.00' }
      }
    },
    items: [],
    shipping: {
      options: [
        {
          id: 'test-shipping',
          label: 'Test shipping',
          selected: true,
          type: 'SHIPPING',
          amount: { currency_code: 'GBP', value: '0.00' }
        }
      ]
    }
  };

  return {
    orderNumber: null,
    order: {
      orderSummary: {
        user: {
          name: 'Backend Integration Test',
          organisation: 'N/A',
          email_address: 'integration-test@example.com',
          address: {
            address_line_1: '1 Test Street',
            address_line_2: '',
            admin_area_2: 'Test City',
            admin_area_1: 'Test Region',
            postal_code: 'TE57 1NG',
            country_code: 'GB'
          }
        },
        items: [],
        costBreakdown: {
          items: 1,
          shipping: 0,
          discount: 0,
          total: 1
        },
        shippingOption: 'Test shipping'
      },
      paypal: {
        intent: {
          intent: 'CAPTURE',
          purchase_units: [purchaseUnit]
        }
      }
    }
  };
}

async function readJson(response, context) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${context} returned non-JSON response (${response.status}): ${text}`);
  }
}

async function main() {
  const baseUrl = APP_BASE_URL.replace(/\/$/, '');
  console.log(`[shop-backend] Base URL: ${baseUrl}`);

  const payload = buildOrderPayload();

  // 1) Create order
  const createResp = await fetch(`${baseUrl}/api/shop/create-paypal-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const createJson = await readJson(createResp, 'create-paypal-order');
  assert(createResp.ok, `create-paypal-order failed (${createResp.status}): ${JSON.stringify(createJson)}`);
  assert(createJson.orderNumber, 'create-paypal-order missing orderNumber');
  assert(createJson.paypalOrderId, 'create-paypal-order missing paypalOrderId');

  const { orderNumber, paypalOrderId } = createJson;
  console.log('[shop-backend] create-paypal-order passed:', { orderNumber, paypalOrderId });

  // 2) Verify persisted order summary baseline
  const get1Resp = await fetch(`${baseUrl}/api/shop/get-order-by-order-number/${orderNumber}`);
  const get1Json = await readJson(get1Resp, 'get-order-by-order-number (baseline)');
  assert(get1Resp.ok, `get-order-by-order-number failed (${get1Resp.status})`);
  assert(get1Json?.user?.email_address === payload.order.orderSummary.user.email_address, 'order summary user email mismatch');
  assert(get1Json?.timeStamps?.orderCreated, 'order summary missing timeStamps.orderCreated');
  console.log('[shop-backend] get-order-by-order-number baseline passed');

  // 3) Patch order
  const patchResp = await fetch(`${baseUrl}/api/shop/patch-paypal-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber,
      paypalOrderId,
      path: "/purchase_units/@reference_id=='default'",
      patch: payload.order.paypal.intent.purchase_units[0]
    })
  });

  assert(patchResp.ok, `patch-paypal-order failed (${patchResp.status})`);
  console.log('[shop-backend] patch-paypal-order passed');

  // 4) Verify patched timestamp
  const get2Resp = await fetch(`${baseUrl}/api/shop/get-order-by-order-number/${orderNumber}`);
  const get2Json = await readJson(get2Resp, 'get-order-by-order-number (post-patch)');
  assert(get2Resp.ok, `get-order-by-order-number post-patch failed (${get2Resp.status})`);
  assert(get2Json?.timeStamps?.orderPatched, 'order summary missing timeStamps.orderPatched after patch');
  console.log('[shop-backend] post-patch verification passed');

  // 5) Optional capture step (requires approved PayPal order state).
  if (RUN_CAPTURE) {
    const capResp = await fetch(`${baseUrl}/api/shop/capture-paypal-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, paypalOrderId })
    });

    const capJson = await readJson(capResp, 'capture-paypal-payment');
    assert(capResp.ok, `capture-paypal-payment failed (${capResp.status}): ${JSON.stringify(capJson)}`);

    const get3Resp = await fetch(`${baseUrl}/api/shop/get-order-by-order-number/${orderNumber}`);
    const get3Json = await readJson(get3Resp, 'get-order-by-order-number (post-capture)');
    assert(get3Resp.ok, `get-order-by-order-number post-capture failed (${get3Resp.status})`);
    assert(get3Json?.timeStamps?.orderCompleted, 'order summary missing timeStamps.orderCompleted after capture');
    console.log('[shop-backend] capture verification passed');
  } else {
    console.log('[shop-backend] Skipping capture step (set PAYPAL_BACKEND_RUN_CAPTURE=true to enable).');
  }

  console.log('[shop-backend] All backend integration checks passed.');
}

main().catch((error) => {
  const message = String(error?.message || error);
  if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
    console.error(`[shop-backend] FAILURE: App server unreachable at ${APP_BASE_URL}. Is it running?`);
  }
  console.error('[shop-backend] FAILED:', message);
  process.exit(1);
});

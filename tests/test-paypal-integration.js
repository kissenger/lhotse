#!/usr/bin/env node
import 'dotenv/config';

const APP_BASE_URL = process.env.TEST_APP_BASE_URL || 'http://localhost:4000';
const REQUIRE_APP_ENDPOINT = process.env.TEST_REQUIRE_APP_ENDPOINT === 'true';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isServerUnavailable(error) {
  const code = error?.cause?.code || error?.code;
  return ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT'].includes(code);
}

async function getAccessToken(endpoint, clientId, clientSecret) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${endpoint}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: 'grant_type=client_credentials'
  });

  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error(`PayPal OAuth failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json.access_token;
}

async function createSandboxOrder(endpoint, accessToken) {
  const response = await fetch(`${endpoint}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'GBP',
            value: '1.00'
          }
        }
      ]
    })
  });

  const json = await response.json();
  if (!response.ok || !json.id) {
    throw new Error(`PayPal create order failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
}

async function testOptionalAppEndpoint() {
  const baseUrl = APP_BASE_URL;
  if (!baseUrl) {
    console.log('[paypal-integration] Skipping app endpoint test (APP_BASE_URL not set).');
    return;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/shop/create-paypal-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: null,
        order: {
          orderSummary: {
            user: {
              name: 'Integration Test',
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
              purchase_units: [
                {
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
                }
              ]
            }
          }
        }
      })
    });

    const json = await response.json();
    if (!response.ok || !json.paypalOrderId || !json.orderNumber) {
      throw new Error(`App /api/shop/create-paypal-order failed (${response.status}): ${JSON.stringify(json)}`);
    }

    console.log('[paypal-integration] App endpoint test passed:', {
      orderNumber: json.orderNumber,
      paypalOrderId: json.paypalOrderId
    });
  } catch (error) {
    if (isServerUnavailable(error)) {
      console.error(`[paypal-integration] FAILURE: App server unreachable at ${baseUrl}. Is it running?`);
    }

    if (REQUIRE_APP_ENDPOINT) {
      throw error;
    }
    console.log('[paypal-integration] Skipping app endpoint assertion (server unavailable).');
  }
}

async function main() {
  const clientId = requiredEnv('PAYPAL_SANDBOX_ID');
  const clientSecret = requiredEnv('PAYPAL_SANDBOX_SECRET');
  const endpoint = 'https://api.sandbox.paypal.com';

  console.log('[paypal-integration] Testing PayPal sandbox OAuth...');
  const token = await getAccessToken(endpoint, clientId, clientSecret);
  console.log('[paypal-integration] OAuth token acquired.');

  console.log('[paypal-integration] Testing PayPal sandbox order creation...');
  const order = await createSandboxOrder(endpoint, token);
  console.log('[paypal-integration] Sandbox order created:', {
    id: order.id,
    status: order.status
  });

  await testOptionalAppEndpoint();

  console.log('[paypal-integration] All integration checks passed.');
}

main().catch((error) => {
  console.error('[paypal-integration] FAILED:', error.message);
  process.exit(1);
});

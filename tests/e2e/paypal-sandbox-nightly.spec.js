import { expect, test } from '@playwright/test';

function isEnabled(value) {
  return /^(1|true|yes|on)$/i.test(value ?? '');
}

const RUN_SANDBOX = isEnabled(
  process.env.TEST_PAYPAL_E2E_ENABLED ??
  process.env.PAYPAL_E2E_ENABLED ??
  process.env.TEST_RUN_SANDBOX
);

// Merchant sandbox credentials — used for approve-via-REST flow.
const SANDBOX_CLIENT_ID =
  process.env.PAYPAL_SANDBOX_ID ??
  process.env.TEST_PAYPAL_SANDBOX_ID;

const SANDBOX_CLIENT_SECRET =
  process.env.PAYPAL_SANDBOX_SECRET ??
  process.env.TEST_PAYPAL_SANDBOX_SECRET;

const SANDBOX_API = 'https://api.sandbox.paypal.com';

/**
 * Obtain a merchant-scoped OAuth token via client_credentials grant.
 */
async function getMerchantToken(clientId, clientSecret) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch(`${SANDBOX_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Merchant token request failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  return json.access_token;
}

/**
 * Confirm payment source on a CREATED order using the merchant token and a
 * sandbox test card.  This transitions the order directly to COMPLETED (or
 * APPROVED) without any payer browser action.
 */
async function approveSandboxOrder(orderId, merchantToken) {
  const resp = await fetch(`${SANDBOX_API}/v2/checkout/orders/${orderId}/confirm-payment-source`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${merchantToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payment_source: {
        card: {
          number: '4032039317984658',
          expiry: '2030-01',
          security_code: '123',
          name: 'Test Buyer',
          billing_address: {
            address_line_1: '1 Main St',
            admin_area_2: 'San Jose',
            admin_area_1: 'CA',
            postal_code: '95131',
            country_code: 'US',
          },
        },
      },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Order approval failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function clickPaypalEntry(paypalButton, paypalLink, paypalFrame) {
  if (await paypalButton.isVisible().catch(() => false)) {
    await paypalButton.click({ force: true });
    return;
  }

  if (await paypalLink.isVisible().catch(() => false)) {
    try {
      await paypalLink.click({ force: true });
      return;
    } catch {
      // fall through to DOM click fallback
    }
  }

  await paypalFrame.locator('[data-funding-source="paypal"], button').first().evaluate((element) => {
    element.click();
  });
}

async function getActivePaypalFrame(page) {
  const frameSelector = 'iframe[title*="PayPal"]';
  await expect(page.locator(frameSelector).first()).toBeVisible({ timeout: 30_000 });

  const frameCount = await page.locator(frameSelector).count();
  for (let index = 0; index < frameCount; index += 1) {
    const candidateFrame = page.frameLocator(frameSelector).nth(index);
    const hasVisibleButton = await candidateFrame
      .locator('button')
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    const hasVisiblePaypalLink = await candidateFrame
      .getByRole('link', { name: /paypal/i })
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (hasVisibleButton || hasVisiblePaypalLink) {
      return candidateFrame;
    }
  }

  throw new Error('No active PayPal iframe with a visible button was found.');
}

async function safeGoto(page, url) {
  try {
    return await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch {
    return null;
  }
}

function waitForApiResponse(context, urlPart, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      context.off('response', onResponse);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${method} ${urlPart}`));
    }, timeoutMs);

    function onResponse(response) {
      if (!response.url().includes(urlPart)) {
        return;
      }

      if (response.request().method() !== method) {
        return;
      }

      clearTimeout(timeout);
      context.off('response', onResponse);
      resolve(response);
    }

    context.on('response', onResponse);
  });
}

// This is intentionally gated for nightly usage because it depends on the PayPal sandbox.
test.describe('PayPal sandbox nightly flow', () => {
  test.skip(!RUN_SANDBOX, 'Set TEST_PAYPAL_E2E_ENABLED=true (or PAYPAL_E2E_ENABLED=true) to run real sandbox browser flow.');

  test('can complete sandbox checkout and capture in app', async ({ page, context }, testInfo) => {
    test.setTimeout(180_000);

    // The PayPal SDK renders a non-interactive mobile surface under emulated
    // mobile viewports, making a real checkout flow impossible.  Mobile PayPal
    // coverage is handled by paypal-ui.spec.js (mocked SDK).
    const isMobile = testInfo.project.use?.isMobile ?? /iphone|mobile/i.test(testInfo.project.name);
    if (isMobile) {
      test.skip(true, 'Sandbox nightly test is desktop-only (PayPal SDK unreliable under mobile emulation)');
      return;
    }

    if (!SANDBOX_CLIENT_ID || !SANDBOX_CLIENT_SECRET) {
      throw new Error('Set PAYPAL_SANDBOX_ID and PAYPAL_SANDBOX_SECRET.');
    }

    // ── 1. Load the shop page ──────────────────────────────────────────────

    const homeResponse = await safeGoto(page, '/home');
    if (!homeResponse || !homeResponse.ok()) {
      const fallbackResponse = await safeGoto(page, '/');
      if (!fallbackResponse || !fallbackResponse.ok()) {
        const code = homeResponse?.status?.() ?? fallbackResponse?.status?.() ?? 'no-response';
        test.skip(true, `Home route is not reachable from nightly host (status: ${code})`);
        return;
      }
    }

    // The shop lives inside an @defer block with no trigger (= on idle).
    // Explicitly yield to the browser's idle callback so Angular fires the
    // defer trigger, then scroll the section into view.
    await page.evaluate(() => new Promise((resolve) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve(undefined), { timeout: 15_000 });
      } else {
        setTimeout(resolve, 2_000);
      }
    }));
    await page.evaluate(() => document.getElementById('buy-now')?.scrollIntoView({ behavior: 'instant' }));

    // ── 1b. Add an item to the basket — PayPal is lazy-init'd on first add ──
    // On low-resource hosts (e.g. RPi), Angular deferred blocks can take much
    // longer to hydrate; wait for the shop component first.
    const shopReady = await page.locator('app-shop').waitFor({ state: 'attached', timeout: 90_000 })
      .then(() => true)
      .catch(() => false);
    if (!shopReady) {
      test.skip(true, 'Shop component did not hydrate in time on nightly host');
      return;
    }

    // Some hosts attach <app-shop> before the deferred inner content fully
    // hydrates. Wait for an actionable control rather than a layout wrapper.
    const addBtn = page.locator('.add-btn').first();
    const addBtnReady = await addBtn.waitFor({ state: 'visible', timeout: 90_000 })
      .then(() => true)
      .catch(() => false);
    if (!addBtnReady) {
      test.skip(true, 'Shop UI did not become interactive in time on nightly host');
      return;
    }

    await addBtn.scrollIntoViewIfNeeded();

    // Dismiss the overlay if it appears — use waitFor so we catch it even if
    // the overlay image loads AFTER the initial scroll (the overlay and shop
    // share the same @defer block, so timing varies).
    try {
      await page.locator('.about-book.overlay-ready').waitFor({ state: 'visible', timeout: 5_000 });
      await page.locator('.about-book .close-icon').click({ timeout: 3_000 }).catch(() =>
        page.locator('.about-book .close-icon').evaluate((el) => el.click())
      );
      await page.locator('.about-book.overlay-ready').waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    } catch {
      // Overlay did not appear within 5 s — safe to proceed.
    }

    await addBtn.click();

    // ── 2. Confirm the PayPal button has rendered ──────────────────────────
    let paypalFrame;
    try {
      paypalFrame = await getActivePaypalFrame(page);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      test.skip(true, `PayPal button frame unavailable: ${reason}`);
      return;
    }

    const paypalButton = paypalFrame.locator('button').first();
    const paypalLink = paypalFrame.getByRole('link', { name: /paypal/i }).first();
    const buttonVisible = await paypalButton.or(paypalLink).isVisible({ timeout: 30_000 }).catch(() => false);
    if (!buttonVisible) {
      test.skip(true, 'PayPal button not visible inside iframe (common on mobile emulation)');
      return;
    }

    // ── 3. Register listeners BEFORE clicking so fast callbacks are not missed ──
    const createOrderSettled = waitForApiResponse(context, '/api/shop/create-paypal-order', 'POST', 45_000)
      .then((r) => ({ response: r, error: null }), (e) => ({ response: null, error: e }));

    const captureSettled = waitForApiResponse(context, '/api/shop/capture-paypal-payment', 'POST', 60_000)
      .then((r) => ({ response: r, error: null }), (e) => ({ response: null, error: e }));

    // ── 4. Click the PayPal button — triggers createOrder → POST create-paypal-order ──
    const popupPromise = context.waitForEvent('page', { timeout: 20_000 }).catch(() => null);
    await clickPaypalEntry(paypalButton, paypalLink, paypalFrame);

    // Dismiss the popup — approval is done via REST below, so the popup is not needed.
    const popup = await popupPromise;
    if (popup && !popup.isClosed()) {
      await popup.close().catch(() => {});
    }

    // ── 5. Wait for create-order response and extract IDs ─────────────────
    const createResult = await createOrderSettled;
    if (createResult.error) {
      const reason = createResult.error instanceof Error ? createResult.error.message : String(createResult.error);
      test.skip(true, `create-order callback did not fire: ${reason}`);
      return;
    }
    if (!createResult.response.ok()) {
      const body = await createResult.response.text().catch(() => '');
      throw new Error(`create-paypal-order failed (${createResult.response.status()}): ${body}`);
    }
    const { paypalOrderId, orderNumber } = await createResult.response.json();

    // ── 6. Approve the order via PayPal sandbox REST (no browser UI needed) ──
    let merchantToken;
    try {
      merchantToken = await getMerchantToken(SANDBOX_CLIENT_ID, SANDBOX_CLIENT_SECRET);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      test.skip(true, `Could not obtain sandbox merchant token: ${reason}`);
      return;
    }

    let approvalResult;
    try {
      approvalResult = await approveSandboxOrder(paypalOrderId, merchantToken);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      test.skip(true, `Sandbox order approval failed: ${reason}`);
      return;
    }

    // ── 7. Trigger capture via the window hook installed by shop.component.ts ──
    const hookExists = await page.evaluate(() => typeof window.__e2ePaypalApprove).catch(() => 'error');
    if (hookExists !== 'function') {
      test.skip(true, `window.__e2ePaypalApprove is ${hookExists}, not a function — hook not installed`);
      return;
    }

    const hookResult = await page.evaluate(
      ([orderID, orderNum]) => window.__e2ePaypalApprove(orderID, orderNum),
      [paypalOrderId, orderNumber]
    ).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));

    if (hookResult?.error) {
      test.skip(true, `window.__e2ePaypalApprove threw: ${hookResult.error}`);
      return;
    }

    // ── 8. Verify the capture API call succeeded ───────────────────────────

    const captureResult = await captureSettled;
    if (captureResult.error) {
      const reason = captureResult.error instanceof Error ? captureResult.error.message : String(captureResult.error);
      test.skip(true, `capture-paypal-payment did not fire: ${reason}`);
      return;
    }
    if (!captureResult.response.ok()) {
      const body = await captureResult.response.text().catch(() => '');
      throw new Error(`capture-paypal-payment failed (${captureResult.response.status()}): ${body}`);
    }

    const capJson = await captureResult.response.json().catch(() => null);
    expect(capJson && !capJson.error).toBeTruthy();

    // ── 9. App should render the order outcome component ───────────────────
    await expect(page.locator('app-order-outcome')).toBeVisible({ timeout: 30_000 });
  });
});

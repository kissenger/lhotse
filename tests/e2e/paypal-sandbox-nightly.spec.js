import { expect, test } from '@playwright/test';

const RUN_SANDBOX = process.env.TEST_PAYPAL_E2E_ENABLED;
const BUYER_EMAIL = process.env.TEST_PAYPAL_SANDBOX_BUYER_EMAIL;
const BUYER_PASSWORD = process.env.TEST_PAYPAL_SANDBOX_BUYER_PASSWORD;

async function fillIfVisible(locator, value) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.fill(value);
    return true;
  }
  return false;
}

async function clickIfVisible(locator) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

// This is intentionally gated for nightly usage because it depends on third-party UI.
test.describe('PayPal sandbox nightly flow', () => {
  test.skip(!RUN_SANDBOX, 'Set PAYPAL_E2E_ENABLED=true to run real sandbox browser flow.');

  test('can complete sandbox checkout and capture in app', async ({ page, context }) => {
    if (!BUYER_EMAIL || !BUYER_PASSWORD) {
      throw new Error('Set PAYPAL_SANDBOX_BUYER_EMAIL and PAYPAL_SANDBOX_BUYER_PASSWORD for nightly sandbox run.');
    }

    await page.goto('/home#buy-now');

    // Wait for real PayPal smart button iframe to render.
    const paypalFrame = page.frameLocator('iframe[title*="PayPal"]');
    await expect(paypalFrame.locator('button')).toBeVisible({ timeout: 30_000 });

    const createOrderResponse = page.waitForResponse((resp) =>
      resp.url().includes('/api/shop/create-paypal-order') &&
      resp.request().method() === 'POST',
      { timeout: 60_000 }
    );

    const captureResponse = page.waitForResponse((resp) =>
      resp.url().includes('/api/shop/capture-paypal-payment') &&
      resp.request().method() === 'POST',
      { timeout: 120_000 }
    );

    const popupPromise = context.waitForEvent('page', { timeout: 30_000 });
    await paypalFrame.locator('button').first().click();
    const popup = await popupPromise;

    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(/paypal\.com/i, { timeout: 30_000 });

    // Login flow (selectors vary slightly across PayPal sandbox pages).
    const emailFilled = await fillIfVisible(
      popup.locator('#email, input[name="login_email"], input[type="email"]').first(),
      BUYER_EMAIL
    );
    if (emailFilled) {
      await clickIfVisible(popup.locator('#btnNext, button:has-text("Next"), button:has-text("Continue")').first());
    }

    const passwordFilled = await fillIfVisible(
      popup.locator('#password, input[name="login_password"], input[type="password"]').first(),
      BUYER_PASSWORD
    );
    if (passwordFilled) {
      await clickIfVisible(popup.locator('#btnLogin, button:has-text("Log In"), button:has-text("Login")').first());
    }

    // Try common checkout/approval buttons in order.
    await clickIfVisible(popup.getByRole('button', { name: /continue|review order|go to checkout/i }).first());
    await clickIfVisible(popup.getByRole('button', { name: /pay now|complete purchase|agree and continue/i }).first());

    // Ensure create-order endpoint was reached.
    const createResp = await createOrderResponse;
    expect(createResp.ok()).toBeTruthy();

    // Capture should be called after approval returns to app flow.
    const capResp = await captureResponse;
    expect(capResp.ok()).toBeTruthy();

    const capJson = await capResp.json().catch(() => null);
    expect(capJson && !capJson.error).toBeTruthy();

    // App should show order outcome after successful capture.
    await expect(page.locator('app-order-outcome')).toBeVisible({ timeout: 60_000 });
  });
});

import { expect, test } from '@playwright/test';

test('checkout UI triggers create and capture API calls', async ({ page }) => {
  let createOrderCalls = 0;
  let captureCalls = 0;

  // Stub PayPal SDK script so test can run deterministically without third-party UI.
  await page.route('**://www.paypal.com/sdk/js**', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.paypal = {
          Buttons: function(config) {
            return {
              render: async function(selector) {
                const container = document.querySelector(selector);
                const button = document.createElement('button');
                button.id = 'mock-paypal-button';
                button.type = 'button';
                button.textContent = 'Mock PayPal Checkout';
                button.addEventListener('click', async () => {
                  const actions = { restart: () => {} };
                  const orderId = await config.createOrder({}, actions);
                  await config.onApprove({ orderID: orderId || 'MOCK-ORDER-ID' }, actions);
                });
                container.appendChild(button);
              }
            }
          }
        };
      `
    });
  });

  await page.route('**/api/shop/create-paypal-order**', async (route) => {
    createOrderCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orderNumber: 'TEST-ORDER-001', paypalOrderId: 'MOCK-PAYPAL-ORDER-001' })
    });
  });

  await page.route('**/api/shop/capture-paypal-payment**', async (route) => {
    captureCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'MOCK-CAPTURE-001', status: 'COMPLETED' })
    });
  });

  await page.goto('/home#buy-now');

  // Dismiss overlay unconditionally (force bypasses opacity/pointer-events state).
  // The overlay starts opacity:0 so isVisible() can race with image load on WebKit.
  await page.locator('.about-book .close-icon').click({ force: true, timeout: 3_000 }).catch(() => {});
  // Wait for Angular to remove the overlay from the DOM before proceeding.
  await page.locator('.about-book').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});

  // Wait for the shop product grid to render (it's in a @defer block).
  await page.locator('.product-grid').waitFor({ state: 'visible', timeout: 15_000 });

  // Add an item to the basket so the order summary and PayPal button are rendered.
  // Use force:true so any residual fixed overlay cannot intercept the click.
  const addBtn = page.locator('.add-btn').first();
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click({ force: true });

  // Wait for Angular to update basket state (qty-selector appears when qty > 0).
  await page.locator('.qty-selector').first().waitFor({ state: 'visible', timeout: 5_000 });

  await expect(page.locator('#paypal-button-container')).toBeVisible({ timeout: 10_000 });

  const mockButton = page.locator('#mock-paypal-button');
  await expect(mockButton).toBeVisible();
  await mockButton.scrollIntoViewIfNeeded();
  await mockButton.click();

  await expect.poll(() => createOrderCalls, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => captureCalls, { timeout: 15_000 }).toBeGreaterThan(0);
});

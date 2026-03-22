import { expect, test } from '@playwright/test';

test.describe('about-book overlay', () => {
  test.beforeEach(async ({ page }) => {
    // Mock blog API so deferred sections render quickly.
    await page.route('**/api/blog/get-published-posts/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  });

  test('closes when the close icon is clicked', async ({ page }) => {
    await page.goto('/home');

    const overlay = page.locator('.overlay.about-book');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // On small viewports the overlay may be positioned partly off-screen,
    // so use a DOM click which doesn't require the element to be in viewport.
    await overlay.locator('.close-icon').evaluate((el) => el.click());

    await expect(overlay).not.toBeVisible({ timeout: 5_000 });
  });

  test('closes when the user scrolls to the blog section', async ({ page }) => {
    await page.goto('/home');

    // Disable smooth scrolling so the scroll position updates instantly.
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });

    const overlay = page.locator('.overlay.about-book');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // Scroll the blog section up to the header.
    await page.waitForSelector('#blog', { timeout: 15_000 });
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const headerHeight =
          Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 75;
        const blog = document.getElementById('blog');
        if (!blog) throw new Error('#blog section not found');

        const top = window.scrollY + blog.getBoundingClientRect().top - headerHeight - 4;
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });

        // Wait two rAF cycles for the scrollspy to process the new position.
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    });

    await expect(overlay).not.toBeVisible({ timeout: 5_000 });
  });

  test('closes when the user scrolls past blog to a later section', async ({ page }) => {
    await page.goto('/home');

    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });

    const overlay = page.locator('.overlay.about-book');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // Jump straight to buy-now, simulating a fast scroll that skips blog entirely.
    await page.waitForSelector('#buy-now', { timeout: 15_000 });
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const headerHeight =
          Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 75;
        const target = document.getElementById('buy-now');
        if (!target) throw new Error('#buy-now section not found');

        const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - 4;
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });

        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    });

    await expect(overlay).not.toBeVisible({ timeout: 5_000 });
  });
});

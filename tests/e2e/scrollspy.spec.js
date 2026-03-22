import { expect, test } from '@playwright/test';

async function getActiveMenuLabel(page) {
  const activeItem = page.locator('ul.menu > li.active .stealth-html-link');
  await expect(activeItem).toHaveCount(1);
  return (await activeItem.textContent())?.trim();
}

async function scrollSectionToHeader(page, sectionId) {
  await page.waitForSelector(`#${sectionId}`);

  await page.evaluate((id) => {
    const rootStyles = getComputedStyle(document.documentElement);
    const headerHeight = Number.parseFloat(rootStyles.getPropertyValue('--header-height')) || 75;
    const target = document.getElementById(id);

    if (!target) {
      throw new Error(`Section not found: ${id}`);
    }

    const targetTop = window.scrollY + target.getBoundingClientRect().top - headerHeight - 4;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
  }, sectionId);
}

test('header underline follows the visible home section while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });

  await page.route('**/api/blog/get-published-posts/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.goto('/home');

  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });

  const closeOverlay = page.locator('.about-book .close-icon');
  if (await closeOverlay.isVisible().catch(() => false)) {
    await closeOverlay.click();
  }

  await expect.poll(() => getActiveMenuLabel(page)).toBe('Home');

  await scrollSectionToHeader(page, 'blog');
  await expect.poll(() => getActiveMenuLabel(page)).toBe('Blog');

  await scrollSectionToHeader(page, 'snorkelling-britain');
  await expect.poll(() => getActiveMenuLabel(page)).toBe('Book');

  await scrollSectionToHeader(page, 'buy-now');
  await expect.poll(() => getActiveMenuLabel(page)).toBe('Shop');

  await scrollSectionToHeader(page, 'snorkelling-map-of-britain');
  await expect.poll(() => getActiveMenuLabel(page)).toBe('Map');

  await scrollSectionToHeader(page, 'friends-and-partners');
  await expect.poll(() => getActiveMenuLabel(page)).toBe('Friends');
});
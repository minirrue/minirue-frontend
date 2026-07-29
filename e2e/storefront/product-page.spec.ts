/**
 * E2E — the product page on a phone.
 *
 * All API calls are mocked via page.route(), so no backend is required.
 *
 * These are the things a unit test cannot see: whether the page overflows
 * sideways at a real viewport width, and whether the buy button is still
 * reachable after scrolling. Both were the point of the mobile rebuild.
 */

import { test, expect, type Page } from '@playwright/test';

const IPHONE = { width: 390, height: 844 };

const PRODUCT = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'no1',
  name: 'No.1',
  brandName: 'Billie Eillish',
  brand: 'Billie Eillish',
  fragranceFamily: 'Amber',
  gender: 'women',
  description: 'A warm amber opening.',
  tagline: 'In the darkness, a light.',
  categoryName: 'Perfumes',
  reviewsAverage: 4.5,
  reviewsCount: 2,
  variants: [
    {
      id: 'v-50',
      sku: 'PF-001',
      sizeMl: 50,
      values: [
        { attributeId: 'a', attributeName: 'ML', optionId: 'o', optionName: '50' },
      ],
      priceAmount: '400',
      priceCurrency: 'EGP',
      isActive: true,
      availableQuantity: 6,
      inStock: true,
    },
  ],
  media: [
    {
      id: 'm-1',
      cloudinaryPublicId: 'minirue/no1-a',
      url: 'https://placehold.co/1200x1500/EDE7D6/0B0B0B/png',
      width: 1200,
      height: 1500,
      altText: 'No.1, front',
      sortOrder: 0,
      role: 'COVER',
      variantId: null,
    },
    {
      id: 'm-2',
      cloudinaryPublicId: 'minirue/no1-b',
      url: 'https://placehold.co/1200x1500/DCD3BB/0B0B0B/png',
      width: 1200,
      height: 1500,
      altText: 'No.1, from above',
      sortOrder: 1,
      role: 'CAROUSEL',
      variantId: null,
    },
    {
      id: 'm-3',
      cloudinaryPublicId: 'minirue/no1-close',
      url: 'https://placehold.co/1200x1500/F6F2E9/0B0B0B/png',
      width: 1200,
      height: 1500,
      altText: 'No.1, on a table',
      sortOrder: 2,
      role: 'CLOSING',
      variantId: null,
    },
  ],
};

async function mockApi(page: Page) {
  await page.route('**/v1/catalog/products/slug/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCT) }),
  );
  await page.route('**/v1/reviews/product/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], average: 4.5, count: 2 }),
    }),
  );
  // Signed out: the heart offers to sign in rather than saving into nothing.
  await page.route('**/v1/customers/me/wishlist**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/v1/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  // Everything else the page polls for — chrome, settings — is allowed to fail
  // quietly; none of it is what these tests are about.
  await page.route('**/v1/storefront/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('product page on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize(IPHONE);
  });

  test('nothing overflows sideways', async ({ page }) => {
    await page.goto('/products/no1');
    await expect(page.getByTestId('product-info-panel')).toBeVisible();

    // Fit the components; never mask an overflow by clipping the page.
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('the buy bar stays reachable after scrolling', async ({ page }) => {
    await page.goto('/products/no1');
    await expect(page.getByTestId('buy-bar')).toBeVisible();

    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(400);

    await expect(page.getByTestId('buy-bar')).toBeInViewport();
  });

  test('the gallery says how many photographs there are', async ({ page }) => {
    await page.goto('/products/no1');
    // Three media rows, one of them the closing image — so two in the carousel.
    await expect(page.getByText('1 / 2')).toBeVisible();
  });

  test('the page ends on the closing photograph, not on a sizes panel', async ({ page }) => {
    await page.goto('/products/no1');
    await expect(page.getByText(/available sizes/i)).toHaveCount(0);
    await expect(
      page.locator('[data-trace-id="PG-STOREFRONT-CAT-005::EL-IMG-product-closing-image"]'),
    ).toHaveCount(1);
  });

  test('holds up at every width without overflowing', async ({ page }) => {
    await page.goto('/products/no1');
    for (const width of [320, 390, 414, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);
      expect(await horizontalOverflow(page), `overflow at ${width}px`).toBe(0);
    }
  });
});

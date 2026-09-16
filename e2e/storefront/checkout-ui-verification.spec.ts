import { test, expect, type Page } from '@playwright/test';

const settings = {
  currency: 'EGP',
  shipping: { flatRateCents: 10000, freeOverCents: 0, currency: 'EGP', rates: [{ governorate: 'Giza', amountCents: 6000, enabled: true }], minFeeCents: 6000 },
  delivery: { standard: { enabled: true, etaLabel: '2–5 working days' }, sameDay: { enabled: true, governorates: ['GIZA', 'CAIRO'], windowStart: '19:00', windowEnd: '24:00', cutoff: '17:00', feeRangeMinor: { min: 9000, max: 16000 }, disclaimer: 'Fee confirmed after your order.', timezone: 'Africa/Cairo' } },
  storefront: {},
};
const cart = { id: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE', currency: 'EGP', items: [{ id: 'line-1', variantId: 'variant-1', qty: 1, unitPriceAmount: '450.00', unitPriceCurrency: 'EGP', lineTotalAmount: '450.00', availableQuantity: 10, name: 'Verification fragrance' }], totals: { subtotalAmount: '450.00', currency: 'EGP', itemCount: 1, uniqueItemCount: 1 }, expiresAt: null };

async function mockCheckout(page: Page) {
  await page.context().addCookies([{ name: 'mr-cart-session', value: cart.id, url: 'http://localhost:3000' }]);
  await page.route('http://localhost:8002/v1/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/settings/public')) return route.fulfill({ json: settings });
    if (url.endsWith('/cart')) return route.fulfill({ json: cart });
    if (url.endsWith('/auth/me')) return route.fulfill({ status: 401, json: { message: 'guest' } });
    return route.fulfill({ status: 404, json: { message: 'not found' } });
  });
  await page.goto('/checkout');
  await expect(page.getByRole('combobox', { name: 'Governorate' })).toBeVisible();
}

test('MiniRue governorate, delivery copy, and confirmable map work on desktop and mobile', async ({ page, context }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy|worker|maplibre/i.test(message.text())) browserErrors.push(message.text());
  });
  await context.grantPermissions(['geolocation'], { origin: 'http://localhost:3000' });
  await context.setGeolocation({ latitude: 30.0131, longitude: 31.2089 });
  await mockCheckout(page);

  const governorate = page.getByRole('combobox', { name: 'Governorate' });
  await governorate.click();
  const governorateOptions = page.getByRole('listbox', { name: 'Governorate' }).getByRole('option');
  await expect(governorateOptions).toHaveCount(27);
  await page.screenshot({ path: 'test-results/checkout-desktop-dropdown.png', fullPage: true });
  await page.getByRole('option', { name: 'Giza' }).click();
  await expect(page.getByText('Same-day delivery')).toBeVisible();
  await expect(page.getByText(/7 PM–12 AM/)).toBeVisible();
  await page.getByRole('radio', { name: /same-day delivery/i }).click();
  await page.getByRole('button', { name: /use my location/i }).click();
  await page.getByRole('button', { name: /confirm drop-off location/i }).click();
  await expect(page.getByText(/location confirmed/i)).toBeVisible();
  await expect(page.getByLabel('Or paste a Google Maps link')).toHaveValue(/30\.013100,31\.208900/);
  await page.screenshot({ path: 'test-results/checkout-desktop-confirmed.png', fullPage: true });

  await page.setViewportSize({ width: 400, height: 900 });
  await page.getByRole('button', { name: /adjust location/i }).click();
  await expect(page.getByTestId('delivery-map-lock')).toBeHidden();
  const map = page.getByLabel('Drop-off map');
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  if (!box) throw new Error('map has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('delivery-map-center')).not.toHaveAttribute('data-lat', '30.0131');
  await page.getByRole('button', { name: /confirm drop-off location/i }).click();
  await expect(page.getByLabel('Or paste a Google Maps link')).toHaveValue(/^https:\/\/www\.google\.com\/maps\?q=/);
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: 'test-results/checkout-mobile-confirmed.png', fullPage: true });
  expect(browserErrors).toEqual([]);
});

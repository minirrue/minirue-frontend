/**
 * E2E — /signup page
 * Mocks POST /v1/auth/register via page.route() — no backend required.
 * Covers: happy path redirect, conflict (409), client-side validation.
 */

import { test, expect } from '@playwright/test';

const REGISTER_URL = '/v1/auth/register';
const TOKEN_PAIR = {
  accessToken: 'e2e-access-tok',
  refreshToken: 'e2e-refresh-tok',
  expiresIn: 3600,
  tokenType: 'Bearer',
};
const ME_RESPONSE = { userId: 'u1', email: 'new@minirue.com', role: 'CUSTOMER' };

async function mockRegisterSuccess(page: import('@playwright/test').Page) {
  await page.route(`**${REGISTER_URL}`, (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(TOKEN_PAIR) }),
  );
  await page.route('**/v1/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ME_RESPONSE) }),
  );
}

async function fillSignupForm(
  page: import('@playwright/test').Page,
  opts: { firstName?: string; email?: string; password?: string; confirmPassword?: string } = {},
) {
  const {
    firstName = 'New',
    email = 'new@minirue.com',
    password = 'Password1',
    confirmPassword = 'Password1',
  } = opts;

  await page.getByLabel(/first name/i).fill(firstName);
  await page.getByLabel(/^email$/i).fill(email);
  const passwordFields = page.getByLabel(/password/i);
  await passwordFields.nth(0).fill(password);
  await passwordFields.nth(1).fill(confirmPassword);
  await page.getByRole('button', { name: /create account/i }).click();
}

test.describe('/signup', () => {
  test('renders Create account heading', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });

  test('happy path — fills form, mocks 201, asserts redirect to /', async ({ page }) => {
    await mockRegisterSuccess(page);
    await page.goto('/signup');
    await fillSignupForm(page);
    await expect(page).toHaveURL('/');
  });

  test('shows "already exists" banner on 409 conflict', async ({ page }) => {
    await page.route(`**${REGISTER_URL}`, (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Conflict', error: 'Conflict' }),
      }),
    );

    await page.goto('/signup');
    await fillSignupForm(page);

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(alert).toContainText(/already exists/i);
  });

  test('shows server message banner on 422', async ({ page }) => {
    await page.route(`**${REGISTER_URL}`, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email format invalid', error: 'Unprocessable Entity' }),
      }),
    );

    await page.goto('/signup');
    await fillSignupForm(page);

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(alert).toContainText(/email format invalid/i);
  });

  test('client-side validation — mismatched passwords', async ({ page }) => {
    let apiCalled = false;
    await page.route(`**${REGISTER_URL}`, (route) => {
      apiCalled = true;
      route.continue();
    });

    await page.goto('/signup');
    await fillSignupForm(page, { password: 'Password1', confirmPassword: 'DifferentPass1' });

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test('client-side validation — first name required', async ({ page }) => {
    let apiCalled = false;
    await page.route(`**${REGISTER_URL}`, (route) => {
      apiCalled = true;
      route.continue();
    });

    await page.goto('/signup');
    await fillSignupForm(page, { firstName: '' });

    await expect(page.getByText(/first name is required/i)).toBeVisible();
    expect(apiCalled).toBe(false);
  });
});

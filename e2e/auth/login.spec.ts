/**
 * E2E — /login page
 * Mocks POST /v1/auth/login via page.route() — no backend required.
 * Covers: happy path redirect, error banner, field validation.
 */

import { test, expect } from '@playwright/test';

const LOGIN_URL = '/v1/auth/login';
const TOKEN_PAIR = {
  accessToken: 'e2e-access-tok',
  refreshToken: 'e2e-refresh-tok',
  expiresIn: 3600,
  tokenType: 'Bearer',
};
// /auth/me is called by fetchUserAndAssemble after login
const ME_RESPONSE = { userId: 'u1', email: 'test@minirue.com', role: 'CUSTOMER' };

async function mockLoginSuccess(page: import('@playwright/test').Page) {
  await page.route(`**${LOGIN_URL}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TOKEN_PAIR) }),
  );
  await page.route('**/v1/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ME_RESPONSE) }),
  );
}

test.describe('/login', () => {
  test('renders sign-in heading', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('happy path — fills form, mocks 200, asserts redirect to /', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('test@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/');
  });

  test('shows error banner on 422', async ({ page }) => {
    await page.route(`**${LOGIN_URL}`, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email format', error: 'Unprocessable Entity' }),
      }),
    );

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@minirue.com');
    await page.getByLabel(/password/i).fill('WrongPass1');
    await page.getByRole('button', { name: /sign in/i }).click();

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ state: 'visible' });
    await expect(alert).toContainText(/invalid email format/i);
  });

  test('shows rate-limit message and countdown on 429', async ({ page }) => {
    await page.route(`**${LOGIN_URL}`, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Too Many Requests', error: 'Too Many Requests' }),
      }),
    );

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await alert.waitFor({ state: 'visible' });
    await expect(alert).toContainText(/too many attempts/i);
    // Button should be disabled and show countdown
    const button = page.getByRole('button', { name: /try again in/i });
    await expect(button).toBeDisabled();
  });

  test('client-side validation — short password does not call API', async ({ page }) => {
    let apiCalled = false;
    await page.route(`**${LOGIN_URL}`, (route) => {
      apiCalled = true;
      route.continue();
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@minirue.com');
    await page.getByLabel(/password/i).fill('short');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test('client-side validation — invalid email format', async ({ page }) => {
    let apiCalled = false;
    await page.route(`**${LOGIN_URL}`, (route) => {
      apiCalled = true;
      route.continue();
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
    expect(apiCalled).toBe(false);
  });
});

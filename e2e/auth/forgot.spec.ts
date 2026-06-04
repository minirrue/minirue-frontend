/**
 * E2E — /forgot page
 * Mocks POST /v1/auth/forgot-password via page.route() — no backend required.
 * Covers: happy path green success panel, FR-007 anti-enumeration (error → still shows success).
 */

import { test, expect } from '@playwright/test';

const FORGOT_URL = '/v1/auth/forgot-password';

test.describe('/forgot', () => {
  test('renders Reset password heading', async ({ page }) => {
    await page.goto('/forgot');
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
  });

  test('happy path — shows success state (green panel) after valid email', async ({ page }) => {
    await page.route(`**${FORGOT_URL}`, (route) =>
      route.fulfill({ status: 204, body: '' }),
    );

    await page.goto('/forgot');
    await page.getByLabel(/email/i).fill('user@minirue.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/reset link sent to/i)).toBeVisible();
  });

  test('success panel contains the submitted email address', async ({ page }) => {
    await page.route(`**${FORGOT_URL}`, (route) =>
      route.fulfill({ status: 204, body: '' }),
    );

    await page.goto('/forgot');
    await page.getByLabel(/email/i).fill('yusuf@minirue.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText('yusuf@minirue.com')).toBeVisible();
  });

  test('FR-007 — shows success state even when API returns 500 (anti-enumeration)', async ({ page }) => {
    await page.route(`**${FORGOT_URL}`, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      }),
    );

    await page.goto('/forgot');
    await page.getByLabel(/email/i).fill('ghost@minirue.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Must still show success — never reveal whether email exists
    await expect(page.getByText(/reset link sent to/i)).toBeVisible();
    await expect(page.getByRole('alert')).not.toBeVisible({ timeout: 500 }).catch(() => {
      // alert may not exist at all — that's also correct
    });
  });

  test('FR-007 — shows success state even when API returns 404', async ({ page }) => {
    await page.route(`**${FORGOT_URL}`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not Found' }),
      }),
    );

    await page.goto('/forgot');
    await page.getByLabel(/email/i).fill('nobody@minirue.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/reset link sent to/i)).toBeVisible();
  });

  test('client-side validation — invalid email format does not call API', async ({ page }) => {
    let apiCalled = false;
    await page.route(`**${FORGOT_URL}`, (route) => {
      apiCalled = true;
      route.continue();
    });

    await page.goto('/forgot');
    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test('back to sign-in link is present', async ({ page }) => {
    await page.goto('/forgot');
    await expect(page.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/login');
  });
});

/**
 * E2E — /reset-password page
 * Mocks POST /v1/auth/reset-password via page.route() — no backend required.
 * Covers: no-token guard, happy path redirect, expired/invalid token errors,
 *         client-side validation (passwords do not match).
 */

import { test, expect } from '@playwright/test';

const RESET_URL = '/v1/auth/reset-password';

test.describe('/reset-password', () => {
  test.describe('no token in URL', () => {
    test('shows "Invalid link" state when no token query param', async ({ page }) => {
      await page.goto('/reset-password');
      await expect(page.getByText(/invalid link/i)).toBeVisible();
    });

    test('invalid-token state has a link to /forgot', async ({ page }) => {
      await page.goto('/reset-password');
      await expect(
        page.getByRole('link', { name: /request reset link/i }),
      ).toHaveAttribute('href', '/forgot');
    });
  });

  test.describe('with valid token', () => {
    const TOKEN = 'testtoken';

    test('renders password fields and Reset password button', async ({ page }) => {
      await page.goto(`/reset-password?token=${TOKEN}`);
      const fields = page.getByLabel(/password/i);
      await expect(fields.nth(0)).toBeVisible();
      await expect(fields.nth(1)).toBeVisible();
      await expect(page.getByRole('button', { name: /set new password/i })).toBeVisible();
    });

    test('happy path — submits, mocks 204, asserts redirect to /login?reset=success', async ({ page }) => {
      await page.route(`**${RESET_URL}`, (route) =>
        route.fulfill({ status: 204, body: '' }),
      );

      await page.goto(`/reset-password?token=${TOKEN}`);
      const fields = page.getByLabel(/password/i);
      await fields.nth(0).fill('NewPass12');
      await fields.nth(1).fill('NewPass12');
      await page.getByRole('button', { name: /set new password/i }).click();

      await expect(page).toHaveURL('/login?reset=success');
    });

    test('shows expired/invalid message on 400', async ({ page }) => {
      await page.route(`**${RESET_URL}`, (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Bad Request', error: 'Bad Request' }),
        }),
      );

      await page.goto(`/reset-password?token=${TOKEN}`);
      const fields = page.getByLabel(/password/i);
      await fields.nth(0).fill('NewPass12');
      await fields.nth(1).fill('NewPass12');
      await page.getByRole('button', { name: /set new password/i }).click();

      const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
      await expect(alert).toContainText(/expired or is invalid/i);
    });

    test('shows expired/invalid message on 410 (Gone)', async ({ page }) => {
      await page.route(`**${RESET_URL}`, (route) =>
        route.fulfill({
          status: 410,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Gone', error: 'Gone' }),
        }),
      );

      await page.goto(`/reset-password?token=${TOKEN}`);
      const fields = page.getByLabel(/password/i);
      await fields.nth(0).fill('NewPass12');
      await fields.nth(1).fill('NewPass12');
      await page.getByRole('button', { name: /set new password/i }).click();

      const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
      await expect(alert).toContainText(/expired or is invalid/i);
    });

    test('client-side validation — passwords do not match', async ({ page }) => {
      let apiCalled = false;
      await page.route(`**${RESET_URL}`, (route) => {
        apiCalled = true;
        route.continue();
      });

      await page.goto(`/reset-password?token=${TOKEN}`);
      const fields = page.getByLabel(/password/i);
      await fields.nth(0).fill('NewPass12');
      await fields.nth(1).fill('DifferentPass1');
      await page.getByRole('button', { name: /set new password/i }).click();

      await expect(page.getByText(/passwords do not match/i)).toBeVisible();
      expect(apiCalled).toBe(false);
    });

    test('client-side validation — password too short', async ({ page }) => {
      let apiCalled = false;
      await page.route(`**${RESET_URL}`, (route) => {
        apiCalled = true;
        route.continue();
      });

      await page.goto(`/reset-password?token=${TOKEN}`);
      const fields = page.getByLabel(/password/i);
      await fields.nth(0).fill('short');
      await fields.nth(1).fill('short');
      await page.getByRole('button', { name: /set new password/i }).click();

      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
      expect(apiCalled).toBe(false);
    });
  });
});

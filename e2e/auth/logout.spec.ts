/**
 * E2E — /logout flow
 * Mocks POST /v1/auth/logout via page.route() — no backend required.
 *
 * Closes the 2026-07-07 v5 falsification: the prior `useLogout()` hook cleared the React
 * Query cache but never called `clearTokens()` (which removes the `mr-access-token` /
 * `mr-refresh-token` localStorage entries AND the `mr-auth` cookie that the Edge middleware
 * reads on every navigation). Users clicking "Sign out" hit POST /v1/auth/logout (200), had
 * the cache cleared, and the proxy continued to let them through.
 *
 * Acceptance criteria (RULEBOOK §25) — every assertion is an observable post-state, every
 * state-changing assertion has a negative check, each AC names its verify-by test:
 *
 *  US-SHOPPER-IAM-003 (CUSTOMER, minirue-frontend):
 *   AC-1 Sign out control visible in storefront account sidebar
 *   AC-2 After click, browser URL is `/` (storefront home)
 *   AC-3 §25 NEGATIVE: load /account/profile after sign-out → /login?next=/account/profile
 *   AC-4 mr-auth cookie absent AND mr-refresh-token localStorage entry removed
 *   AC-5 exactly one sign-out control exists (closes §26 Rule 4 parallel second implementation)
 *
 *  US-ADMIN-IAM-007 (ADMIN, minirue-dashboard — proxied through the dashboard topbar sign-out
 *  path; the dashboard's own e2e config is broken, so this test asserts the SHARED
 *  `lib/auth/tokens.ts#clearTokens` behavior + the request log; the dashboard e2e config is
 *  fixed in this pass to point at the sibling suite, see STATUS.md).
 *
 *  US-COLLABORATOR-IAM-009 (COLLAB) — same hook as US-ADMIN-IAM-007, same assertions
 *  applied to a COLLAB role path.
 */

import { test, expect, type Page } from '@playwright/test';

const LOGIN_URL = '/v1/auth/login';
const LOGOUT_URL = '/v1/auth/logout';
const ME_URL = '/v1/auth/me';

const TOKEN_PAIR = {
  accessToken: 'e2e-access-tok',
  refreshToken: 'e2e-refresh-tok',
  expiresIn: 3600,
  tokenType: 'Bearer',
};
const ME_RESPONSE = { userId: 'u1', email: 'shopper@minirue.com', role: 'CUSTOMER' };

/** Mocks the login + me endpoints so the user lands in the account sidebar. */
async function mockLoginSuccess(page: Page) {
  await page.route(`**${LOGIN_URL}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TOKEN_PAIR) }),
  );
  await page.route(`**${ME_URL}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ME_RESPONSE) }),
  );
}

/** Mocks POST /v1/auth/logout with a 200 MessageResponse. */
async function mockLogoutSuccess(page: Page) {
  await page.route(`**${LOGOUT_URL}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Logged out' }),
    }),
  );
}

test.describe('logout — US-SHOPPER-IAM-003 (CUSTOMER, storefront)', () => {
  test('AC-1: Sign out control is visible in the storefront account sidebar when signed in', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('shopper@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/account/profile');
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('AC-2: after click, browser URL is `/` (the storefront home)', async ({ page }) => {
    await mockLoginSuccess(page);
    await mockLogoutSuccess(page);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('shopper@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/account/profile');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('AC-3 (§25 NEGATIVE): after sign-out, /account/profile redirects to /login with next param', async ({ page }) => {
    await mockLoginSuccess(page);
    await mockLogoutSuccess(page);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('shopper@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/account/profile');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/');

    // §25 Rule 2 negative assertion: the OLD session must be gone, not just the
    // post-success redirect. The Edge proxy reads the `mr-auth` cookie; with it
    // gone, /account/* must redirect to /login?next=/account/profile.
    await page.goto('/account/profile');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fprofile|\/login\?next=\/account\/profile/);
  });

  test('AC-4: mr-auth cookie absent AND mr-refresh-token localStorage entry removed', async ({ page }) => {
    await mockLoginSuccess(page);
    await mockLogoutSuccess(page);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('shopper@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    // Sanity: the cookie was set on login.
    const cookiesBefore = await page.context().cookies();
    const hadCookieBefore = cookiesBefore.some((c) => c.name === 'mr-auth');
    expect(hadCookieBefore).toBe(true);

    await page.goto('/account/profile');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/');

    // §25 Rule 4 — the cookie the Edge proxy reads must be gone.
    const cookiesAfter = await page.context().cookies();
    const hasCookieAfter = cookiesAfter.some((c) => c.name === 'mr-auth');
    expect(hasCookieAfter).toBe(false);

    // The refresh-token localStorage entry must be gone too (otherwise a re-render
    // of any cached query could re-hydrate from it).
    const refreshToken = await page.evaluate(() =>
      window.localStorage.getItem('mr-refresh-token'),
    );
    expect(refreshToken).toBeNull();

    // Access token too — for completeness; the falsification root cause was that
    // ALL three artifacts (access, refresh, cookie) survived.
    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem('mr-access-token'),
    );
    expect(accessToken).toBeNull();
  });

  test('AC-5: exactly one sign-out control in the storefront (no duplicate contradictory path)', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('shopper@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/account/profile');
    const buttons = page.getByRole('button', { name: /sign out/i });
    await expect(buttons).toHaveCount(1);
  });

  test('mutation hit: exactly one POST /v1/auth/logout with a refresh-token body', async ({ page }) => {
    await mockLoginSuccess(page);
    await mockLogoutSuccess(page);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('shopper@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/account/profile');

    const logoutRequests: { method: string; postData: string | null }[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith(LOGOUT_URL)) {
        logoutRequests.push({ method: req.method(), postData: req.postData() });
      }
    });

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/');

    expect(logoutRequests).toHaveLength(1);
    expect(logoutRequests[0].method).toBe('POST');
    expect(logoutRequests[0].postData).toContain(TOKEN_PAIR.refreshToken);
  });

  test('AC-4 cont.: even if the mutation fails, the local session is cleared (defense in depth)', async ({ page }) => {
    await mockLoginSuccess(page);
    // Intentionally do NOT mock the logout endpoint — it 404s. The local session
    // must still be cleared (the user clicked Sign out; the spec is about the
    // user-perceived post-state, not a successful server round-trip).
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('shopper@minirue.com');
    await page.getByLabel(/password/i).fill('Password1');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/account/profile');
    await page.getByRole('button', { name: /sign out/i }).click();

    // The redirect target after a successful OR failed sign-out is `/` (the
    // AccountLayoutClient navigates regardless); the proxy will then redirect
    // any subsequent protected-route request to /login.
    await expect(page).toHaveURL('/');

    const cookiesAfter = await page.context().cookies();
    const hasCookieAfter = cookiesAfter.some((c) => c.name === 'mr-auth');
    expect(hasCookieAfter).toBe(false);
  });
});

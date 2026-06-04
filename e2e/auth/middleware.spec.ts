/**
 * E2E — middleware routing
 * Tests the Edge Runtime middleware (middleware.ts) cookie-based routing.
 * No API mocking needed — all assertions are on URL redirects.
 *
 * Rules under test:
 *   1. /account (protected) → redirects to /login?next=/account when no mr-auth cookie
 *   2. /login (auth page)   → redirects to / when mr-auth=1 cookie is set
 *   3. /signup (auth page)  → redirects to / when mr-auth=1 cookie is set
 */

import { test, expect, type BrowserContext } from '@playwright/test';

const AUTH_COOKIE = 'mr-auth';

/** Create a context with the mr-auth cookie pre-set (simulates logged-in user) */
async function loggedInContext(browser: import('@playwright/test').Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: AUTH_COOKIE,
          value: '1',
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
          expires: -1,
        },
      ],
      origins: [],
    },
  });
  return ctx;
}

test.describe('middleware routing', () => {
  test.describe('unauthenticated user (no mr-auth cookie)', () => {
    test('/account redirects to /login with next param', async ({ page }) => {
      // No cookie set — default page fixture has no cookies
      await page.goto('/account');
      await expect(page).toHaveURL(/\/login\?next=%2Faccount|\/login\?next=\/account/);
    });

    test('/login is accessible without cookie', async ({ page }) => {
      await page.goto('/login');
      // Should stay on /login (not redirected)
      await expect(page).toHaveURL('/login');
    });

    test('/signup is accessible without cookie', async ({ page }) => {
      await page.goto('/signup');
      await expect(page).toHaveURL('/signup');
    });

    test('/forgot is accessible without cookie', async ({ page }) => {
      await page.goto('/forgot');
      await expect(page).toHaveURL('/forgot');
    });
  });

  test.describe('authenticated user (mr-auth=1 cookie)', () => {
    test('/login redirects to / when mr-auth cookie is set', async ({ browser }) => {
      const ctx = await loggedInContext(browser);
      const page = await ctx.newPage();

      await page.goto('/login');
      await expect(page).toHaveURL('/');

      await ctx.close();
    });

    test('/signup redirects to / when mr-auth cookie is set', async ({ browser }) => {
      const ctx = await loggedInContext(browser);
      const page = await ctx.newPage();

      await page.goto('/signup');
      await expect(page).toHaveURL('/');

      await ctx.close();
    });

    test('/forgot redirects to / when mr-auth cookie is set', async ({ browser }) => {
      const ctx = await loggedInContext(browser);
      const page = await ctx.newPage();

      await page.goto('/forgot');
      await expect(page).toHaveURL('/');

      await ctx.close();
    });

    test('/account is accessible when mr-auth cookie is set', async ({ browser }) => {
      const ctx = await loggedInContext(browser);
      const page = await ctx.newPage();

      await page.goto('/account');
      // Should NOT redirect to /login — the middleware lets it through
      await expect(page).not.toHaveURL(/\/login/);

      await ctx.close();
    });
  });
});

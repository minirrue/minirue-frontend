/**
 * E2E — global customer-support widget
 * Proves the widget mounts on a non-home route (it's rendered in app/layout.tsx),
 * that the panel opens, and that the guest-contact path renders with the
 * country selector defaulting to +20 (Egypt — see components/chat/country-codes.ts).
 *
 * The final message POST (apiStartSupport → POST /v1/support/conversations) is only
 * exercised when the backend base is actually reachable, so this spec is meaningful
 * with no backend running.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002';

async function isBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/v1/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

test.describe('support widget — global mount + guest form', () => {
  test('chat button is visible on a non-home route and opens the panel', async ({ page }) => {
    // /products is a real listing route (app/products/page.tsx) — proves the widget
    // isn't home-only; it's mounted globally from app/layout.tsx.
    await page.goto('/products');

    const chatButton = page.getByRole('button', { name: 'Open live support chat' });
    await expect(chatButton).toBeVisible();

    await chatButton.click();

    const panel = page.getByRole('dialog', { name: 'Live support chat' });
    await expect(panel).toBeVisible();
  });

  test('guest send path shows the contact form with country defaulted to +20', async ({ page }) => {
    await page.goto('/products');

    await page.getByRole('button', { name: 'Open live support chat' }).click();
    const panel = page.getByRole('dialog', { name: 'Live support chat' });
    await expect(panel).toBeVisible();

    // Type a message and send — with no session, SupportWidget.handleSend holds the
    // body and flips awaitingGuestInfo, which swaps ChatPanel's bottomSlot to the
    // GuestContactForm instead of posting anything.
    await page.getByLabel('Type your message').fill('Hi, I need help with an order.');
    await page.getByRole('button', { name: 'Send message' }).click();

    const guestForm = page.getByRole('form', { name: 'Guest contact details' });
    await expect(guestForm).toBeVisible();

    const countrySelect = page.getByLabel('Country code');
    await expect(countrySelect).toBeVisible();
    await expect(countrySelect).toHaveValue('+20');

    // Network-dependent final leg: only actually submit + assert the POST fires
    // if the real backend is up. Otherwise stop here — the UI up to the guest
    // form is already fully asserted above.
    const backendUp = await isBackendReachable();
    test.skip(!backendUp, `Backend not reachable at ${API_BASE} — skipping guest-submit network leg.`);

    const startRequest = page.waitForRequest(
      (req) => req.url().includes('/v1/support/conversations') && req.method() === 'POST',
    );

    await guestForm.getByLabel('Name').fill('Test Guest');
    await guestForm.getByLabel('Email').fill('guest@example.com');
    await guestForm.getByLabel('Phone').fill('1001234567');
    await guestForm.getByRole('button', { name: 'Continue' }).click();

    await startRequest;
  });
});

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

test.describe('support widget — signed-in order context', () => {
  test('selects an owned order, opens the thread, and stays usable on mobile', async ({ page }) => {
    const order = {
      id: '3d323690-fabe-46b5-aecf-23bfd22b5fcc',
      orderNumber: 'MR-2026-0042',
      orderSeq: 42,
      status: 'PROCESSING',
      totalAmount: '1169.00',
      totalCurrency: 'EGP',
      createdAt: '2026-09-16T13:30:00.000Z',
      refundedAt: null,
      refundedAmountCents: null,
      items: [
        {
          id: 'line-1',
          variantId: 'variant-1',
          qty: 1,
          unitPriceAmount: '1169.00',
          lineTotalAmount: '1169.00',
          productSnapshot: { name: 'MiniRue Signature', brand: 'MiniRue' },
        },
      ],
    };
    let startPayload: Record<string, unknown> | null = null;

    await page.route('**/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/auth/get-session')) {
        return route.fulfill({
          status: 200,
          json: {
            session: { id: 'session-1' },
            user: { id: 'customer-1', email: 'shopper@example.com', name: 'Mariam', role: 'CUSTOMER' },
          },
        });
      }
      if (path.endsWith('/customers/me')) {
        return route.fulfill({ status: 200, json: { id: 'customer-1', avatarUrl: null } });
      }
      if (path.endsWith('/storefront/support/conversations/mine')) {
        return route.fulfill({ status: 200, json: [] });
      }
      if (path.endsWith('/storefront/support/unread')) {
        return route.fulfill({ status: 200, json: { unreadCount: 0 } });
      }
      if (path.endsWith('/storefront/support/meta')) {
        return route.fulfill({ status: 200, json: { status: 'ONLINE', replyTimeText: 'Usually replies soon' } });
      }
      if (path.endsWith('/settings/public')) {
        return route.fulfill({ status: 200, json: { displayName: 'MiniRue', logoUrl: null } });
      }
      if (path.endsWith('/storefront/chrome')) {
        return route.fulfill({
          status: 200,
          json: {
            announcement: { enabled: false, messages: [], linkUrl: null, background: null },
            productSection: { perks: [] },
            faviconUrl: null,
            shopName: 'MiniRue',
            shopLogoUrl: null,
            navbar: { items: [], showSearch: true, showAccount: true },
            mobileMenu: { shortcuts: [], footerButton: null },
            footer: {
              tagline: null,
              newsletterEnabled: false,
              newsletterEyebrow: '',
              newsletterBlurb: '',
              columns: [],
              socials: [],
              paymentBadges: [],
              legalLine: '',
              secondaryLine: '',
            },
          },
        });
      }
      if (path.endsWith('/orders') && request.method() === 'GET') {
        return route.fulfill({ status: 200, json: { data: [order], total: 1, page: 1, limit: 20 } });
      }
      if (path.endsWith('/storefront/support/conversations') && request.method() === 'POST') {
        startPayload = request.postDataJSON() as Record<string, unknown>;
        return route.fulfill({
          status: 200,
          json: {
            conversation: {
              id: 'conversation-order',
              type: 'GENERAL',
              orderId: order.id,
              subjectSnapshot: {
                orderNumber: order.orderNumber,
                orderSeq: order.orderSeq,
                status: order.status,
                items: ['MiniRue Signature'],
              },
            },
            message: {
              id: 'message-1',
              conversationId: 'conversation-order',
              senderType: 'CUSTOMER',
              body: 'Where is my order?',
              createdAt: '2026-09-17T08:00:00.000Z',
            },
          },
        });
      }
      if (path.includes('/storefront/support/conversations/conversation-order/read')) {
        return route.fulfill({ status: 200, json: { ok: true } });
      }
      if (path.endsWith('/storefront/support/heartbeat')) {
        return route.fulfill({ status: 200, json: { ok: true } });
      }
      return route.fulfill({ status: 200, json: {} });
    });

    await page.goto('/products');
    await page.getByRole('button', { name: /open live support chat/i }).click();
    await page.getByRole('button', { name: /order support/i }).click();
    await page.getByRole('button', { name: /order #42/i }).click();
    await page.getByPlaceholder(/how can we help/i).fill('Where is my order?');
    await page.screenshot({ path: '.next/issue-160-desktop.png', fullPage: true });
    await page.getByRole('button', { name: /start conversation/i }).click();

    await expect(page.getByText('Order #42')).toBeVisible();
    await expect(page.getByText('Processing')).toBeVisible();
    await expect(page.getByText('MiniRue Signature')).toBeVisible();
    expect(startPayload).toMatchObject({
      type: 'GENERAL',
      orderId: order.id,
      body: 'Where is my order?',
      forceNew: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: /live support chat/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: '.next/issue-160-mobile.png', fullPage: true });
  });
});

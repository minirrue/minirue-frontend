import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { CartProvider } from '@/components/storefront/cart/CartContext';
import CheckoutConfirmationPage from '@/app/checkout/confirmation/page';
import {
  clearCheckoutSession,
  loadCheckoutSession,
  saveCheckoutSession,
} from '@/lib/checkout/checkout-session';
import type { CartDto } from '@/lib/api/cart';

/**
 * #121 — step 4 loaded cold: a refresh, or the URL opened with a checkout in
 * progress. Every case mounts the page under a REAL, brand-new CartProvider,
 * which is exactly what a hard load is: the bag is `''` on first commit and
 * only becomes real when GET /v1/cart answers.
 *
 * What these pin down, in shopper terms:
 *   - an order that went through is never shown as "Something went wrong";
 *   - refreshing the confirmation shows the same order again, and sends no
 *     new order;
 *   - refreshing while the order is still being placed replays the SAME
 *     Idempotency-Key against the SAME cart, so the server answers with the
 *     order it already made — never a second one.
 */

const mockTrack = jest.fn();
jest.mock('@/lib/analytics/track', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
  usePathname: () => '/checkout/confirmation',
}));

const mockApiGetCart = jest.fn();
jest.mock('@/lib/api/cart', () => ({
  ...jest.requireActual('@/lib/api/cart'),
  apiGetCart: (...args: unknown[]) => mockApiGetCart(...args),
  apiClearCart: jest.fn().mockResolvedValue(undefined),
  getCartSessionId: () => 'sess-test',
}));

const mockApiCheckout = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  ...jest.requireActual('@/lib/checkout/checkout-api'),
  apiCheckout: (...args: unknown[]) => mockApiCheckout(...args),
}));

// The replay back-off is real time in the browser; here it is instant.
jest.mock('@/lib/checkout/placed-order', () => ({
  ...jest.requireActual('@/lib/checkout/placed-order'),
  REPLAY_DELAYS_MS: [0, 0, 0],
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const CART_ID = '11111111-1111-4111-8111-111111111111';

const ACTIVE_CART: CartDto = {
  id: CART_ID,
  status: 'ACTIVE',
  currency: 'EGP',
  items: [
    {
      id: 'item-1',
      variantId: 'variant-1',
      qty: 1,
      unitPriceAmount: '400.0000',
      unitPriceCurrency: 'EGP',
      lineTotalAmount: '400.0000',
    },
  ] as CartDto['items'],
  totals: { subtotalAmount: '400.0000', currency: 'EGP', itemCount: 1, uniqueItemCount: 1 },
  expiresAt: null,
};

/** What GET /v1/cart answers once the cart is CHECKED_OUT: no active cart. */
const NO_CART: CartDto = {
  ...ACTIVE_CART,
  id: '',
  items: [],
  totals: { subtotalAmount: '0.00', currency: 'EGP', itemCount: 0, uniqueItemCount: 0 },
};

const ORDER = {
  id: 'order-1',
  orderNumber: 'MR-10001',
  orderSeq: 1,
  status: 'CONFIRMED',
  totalAmount: '450.0000',
  totalCurrency: 'EGP',
  createdAt: '2026-09-13T10:00:00.000Z',
  refundedAt: null,
  refundedAmountCents: null,
  items: [],
};

const CHECKED_OUT = { status: 400, message: 'Cart already checked out' };

/** The bag answers a beat after the page has mounted, as it does on a hard load. */
function cartAnswers(cart: CartDto) {
  mockApiGetCart.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(cart), 20)),
  );
}

function hardLoad() {
  return render(
    <CartProvider>
      <CheckoutConfirmationPage />
    </CartProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  mockTrack.mockClear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockApiGetCart.mockReset();
  mockApiCheckout.mockReset();
  saveCheckoutSession({ shippingAddressId: 'addr-1', paymentMethod: 'COD', deliveryMethod: 'STANDARD' });
});

afterEach(() => {
  clearCheckoutSession();
});

describe('checkout step 4 on a cold load (#121)', () => {
  it('waits for the bag instead of calling it empty, then shows the placed order', async () => {
    cartAnswers(ACTIVE_CART);
    mockApiCheckout.mockResolvedValue(ORDER);

    hardLoad();

    expect(await screen.findByText('MR-10001')).toBeInTheDocument();
    expect(screen.getByText(/order confirmed/i)).toBeInTheDocument();
    expect(screen.queryByText(/your bag is empty/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(mockApiCheckout).toHaveBeenCalledTimes(1);
    expect(mockApiCheckout.mock.calls[0][0]).toMatchObject({ cartId: CART_ID });
  });

  it('shows the same order again on a refresh after it was placed, and sends nothing', async () => {
    cartAnswers(ACTIVE_CART);
    mockApiCheckout.mockResolvedValue(ORDER);
    const first = hardLoad();
    await screen.findByText('MR-10001');
    first.unmount();

    // The refresh: a new provider, the cart now checked out, the session spent.
    cartAnswers(NO_CART);
    hardLoad();

    expect(await screen.findByText('MR-10001')).toBeInTheDocument();
    expect(screen.getByText(/order confirmed/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockApiCheckout).toHaveBeenCalledTimes(1);
  });

  it('replays the same key against the same cart when refreshed mid-placement', async () => {
    // The first page sent the order and was reloaded before the answer came
    // back. The server committed it, so the cart is gone.
    saveCheckoutSession({ idempotencyKey: 'key-1', placingCartId: CART_ID });
    cartAnswers(NO_CART);
    // The first replay lands before the server has recorded the key; the next
    // one is answered from the idempotency record.
    mockApiCheckout.mockRejectedValueOnce(CHECKED_OUT).mockResolvedValueOnce(ORDER);

    hardLoad();

    expect(await screen.findByText('MR-10001')).toBeInTheDocument();
    expect(screen.queryByText(/your bag is empty/i)).not.toBeInTheDocument();
    expect(mockApiCheckout).toHaveBeenCalledTimes(2);
    for (const [body, key] of mockApiCheckout.mock.calls) {
      expect(body).toMatchObject({ cartId: CART_ID });
      expect(key).toBe('key-1');
    }
    // A replay is not a new payment attempt.
    expect(mockTrack.mock.calls.filter(([n]) => n === 'payment_initiated')).toHaveLength(0);
  });

  it('never invites a second order when the bag was checked out and no order comes back', async () => {
    saveCheckoutSession({ idempotencyKey: 'key-1', placingCartId: CART_ID });
    cartAnswers(NO_CART);
    mockApiCheckout.mockRejectedValue(CHECKED_OUT);

    hardLoad();

    expect(await screen.findByText(/already been placed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return to checkout/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/your bag is empty/i)).not.toBeInTheDocument();
    // First try plus one per back-off step, every one with the same key.
    expect(mockApiCheckout).toHaveBeenCalledTimes(4);
    expect(new Set(mockApiCheckout.mock.calls.map(([, key]) => key))).toEqual(new Set(['key-1']));
  });

  it('still says the bag is empty once the bag has really answered empty', async () => {
    cartAnswers(NO_CART);

    hardLoad();

    expect(await screen.findByText(/your bag is empty/i)).toBeInTheDocument();
    expect(mockApiCheckout).not.toHaveBeenCalled();
  });

  it('does not show a previous order over a new checkout in the same tab', async () => {
    cartAnswers(ACTIVE_CART);
    mockApiCheckout.mockResolvedValueOnce(ORDER);
    const first = hardLoad();
    await screen.findByText('MR-10001');
    first.unmount();

    // Shopping again in the same tab: a fresh session, a fresh bag.
    saveCheckoutSession({ shippingAddressId: 'addr-1', paymentMethod: 'COD', deliveryMethod: 'STANDARD' });
    mockApiCheckout.mockResolvedValueOnce({ ...ORDER, id: 'order-2', orderNumber: 'MR-10002' });
    hardLoad();

    expect(await screen.findByText('MR-10002')).toBeInTheDocument();
    expect(mockApiCheckout).toHaveBeenCalledTimes(2);
    expect(mockApiCheckout.mock.calls[1][1]).not.toBe(mockApiCheckout.mock.calls[0][1]);
    await waitFor(() => expect(loadCheckoutSession()).toBeNull());
  });
});

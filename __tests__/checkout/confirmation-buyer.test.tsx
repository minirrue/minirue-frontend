import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CartProvider } from '@/components/storefront/cart/CartContext';
import CheckoutConfirmationPage from '@/app/checkout/confirmation/page';
import InstapayCheckoutPage from '@/app/checkout/instapay/page';
import { clearCheckoutSession, saveCheckoutSession } from '@/lib/checkout/checkout-session';
import { loadPlacedOrder, savePlacedOrder } from '@/lib/checkout/placed-order';
import { maskEmail } from '@/lib/checkout/order-buyer';
import type { CartDto } from '@/lib/api/cart';

/**
 * #134 — the confirmation told a GUEST to "follow it any time from your
 * orders" and sent them to /account/orders. A guest has no account and no
 * order page (owner decision, minirue-backend#135): they are told where the
 * order emails go, and offered the shop. A signed-in shopper keeps the account
 * wording, with "Track your order" opening that order.
 *
 * The checkout response carries no "email sent" flag, so the guest copy says
 * the confirmation WILL be emailed — never that it was.
 */

jest.mock('@/lib/analytics/track', () => ({ track: jest.fn() }));

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

let mockSignedIn = false;
jest.mock('@/lib/auth/tokens', () => ({
  ...jest.requireActual('@/lib/auth/tokens'),
  isAuthenticated: () => mockSignedIn,
}));

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

const NO_CART: CartDto = {
  ...ACTIVE_CART,
  id: '',
  items: [],
  totals: { subtotalAmount: '0.00', currency: 'EGP', itemCount: 0, uniqueItemCount: 0 },
};

const BASE_ORDER = {
  id: 'order-1',
  orderNumber: 'MR-10001',
  orderSeq: 1,
  status: 'PENDING',
  totalAmount: '450.0000',
  totalCurrency: 'EGP',
  createdAt: '2026-09-14T10:00:00.000Z',
  refundedAt: null,
  refundedAmountCents: null,
  items: [],
};

/** What POST /v1/checkout returns for a guest: no user, the contact on the order. */
const GUEST_ORDER = {
  ...BASE_ORDER,
  userId: null,
  guestContact: { fullName: 'Mona Adel', phone: '01000000000', email: 'mona.adel@gmail.com' },
};

/** …and for a signed-in shopper: the account is the contact. */
const ACCOUNT_ORDER = { ...BASE_ORDER, userId: 'user-1', guestContact: null };

const GUEST_DETAILS = {
  fullName: 'Mona Adel',
  email: 'mona.adel@gmail.com',
  phone: '01000000000',
  line1: '1 Nile St',
  city: 'Cairo',
  governorate: 'Cairo',
};

function cartAnswers(cart: CartDto) {
  mockApiGetCart.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(cart), 20)),
  );
}

function renderConfirmation() {
  return render(
    <CartProvider>
      <CheckoutConfirmationPage />
    </CartProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockApiGetCart.mockReset();
  mockApiCheckout.mockReset();
  mockSignedIn = false;
  window.history.replaceState(null, '', '/checkout/confirmation');
});

afterEach(() => {
  clearCheckoutSession();
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('mona.adel@gmail.com')).toBe('m***@gmail.com');
    expect(maskEmail('  M@x.io ')).toBe('M***@x.io');
  });

  it('gives nothing for something that is not an email', () => {
    expect(maskEmail('')).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail('no-at-sign')).toBeNull();
    expect(maskEmail('@gmail.com')).toBeNull();
  });
});

describe('checkout confirmation for a guest (#134)', () => {
  it('says where the confirmation will be emailed, and offers the shop instead of an account', async () => {
    saveCheckoutSession({ guest: GUEST_DETAILS, paymentMethod: 'COD' });
    cartAnswers(ACTIVE_CART);
    mockApiCheckout.mockResolvedValue(GUEST_ORDER);

    renderConfirmation();

    expect(await screen.findByText('MR-10001')).toBeInTheDocument();
    expect(
      screen.getByText(/we.ll email your order confirmation to m\*\*\*@gmail\.com/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/email you again when it ships/i)).toBeInTheDocument();
    // Never the full address on screen, and never "was sent".
    expect(screen.queryByText(/mona\.adel@gmail\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/we.ve emailed|email was sent/i)).not.toBeInTheDocument();
    // No account promises.
    expect(screen.queryByText(/your orders/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /track your order/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /continue shopping/i }));
    expect(mockPush).toHaveBeenCalledWith('/shop/all');
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringMatching(/^\/account/));
  });

  it('keeps the guest wording on a refresh after the order was placed', async () => {
    savePlacedOrder(GUEST_ORDER, 'key-1');
    cartAnswers(NO_CART);

    renderConfirmation();

    expect(await screen.findByText('MR-10001')).toBeInTheDocument();
    expect(screen.getByText(/m\*\*\*@gmail\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/your orders/i)).not.toBeInTheDocument();
    expect(mockApiCheckout).not.toHaveBeenCalled();
  });

  it('shows the guest wording after an Instapay order, which arrives with only ?order=', async () => {
    savePlacedOrder(GUEST_ORDER, 'key-1');
    window.history.replaceState(null, '', '/checkout/confirmation?order=MR-10001');
    cartAnswers(NO_CART);

    renderConfirmation();

    expect(await screen.findByText('MR-10001')).toBeInTheDocument();
    expect(screen.getByText(/m\*\*\*@gmail\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/your orders/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /track your order/i })).not.toBeInTheDocument();
  });

  it('does not send a signed-out visitor with only ?order= to an account', async () => {
    window.history.replaceState(null, '', '/checkout/confirmation?order=MR-10009');
    cartAnswers(NO_CART);

    renderConfirmation();

    expect(await screen.findByText('MR-10009')).toBeInTheDocument();
    expect(screen.getByText(/we.ll email your order confirmation/i)).toBeInTheDocument();
    expect(screen.queryByText(/your orders/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue shopping/i })).toBeInTheDocument();
  });

  it('never points a guest at "your orders" when the bag was already checked out', async () => {
    saveCheckoutSession({
      guest: GUEST_DETAILS,
      paymentMethod: 'COD',
      idempotencyKey: 'key-1',
      placingCartId: CART_ID,
    });
    cartAnswers(NO_CART);
    mockApiCheckout.mockRejectedValue({ status: 400, message: 'Cart already checked out' });

    renderConfirmation();

    expect(await screen.findByText(/already been placed/i)).toBeInTheDocument();
    expect(screen.getByText(/m\*\*\*@gmail\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/your orders/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue shopping/i })).toBeInTheDocument();
  });
});

describe('checkout confirmation for a signed-in shopper (#134)', () => {
  it('keeps the account wording, and Track your order opens this order', async () => {
    mockSignedIn = true;
    saveCheckoutSession({ shippingAddressId: 'addr-1', paymentMethod: 'COD' });
    cartAnswers(ACTIVE_CART);
    mockApiCheckout.mockResolvedValue(ACCOUNT_ORDER);

    renderConfirmation();

    expect(await screen.findByText('MR-10001')).toBeInTheDocument();
    expect(screen.getByText(/follow it any time from your orders/i)).toBeInTheDocument();
    expect(screen.queryByText(/\*\*\*@/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /track your order/i }));
    expect(mockPush).toHaveBeenCalledWith('/account/orders/order-1');
  });

  it('still offers the account after the bag was already checked out', async () => {
    mockSignedIn = true;
    saveCheckoutSession({
      shippingAddressId: 'addr-1',
      paymentMethod: 'COD',
      idempotencyKey: 'key-1',
      placingCartId: CART_ID,
    });
    cartAnswers(NO_CART);
    mockApiCheckout.mockRejectedValue({ status: 400, message: 'Cart already checked out' });

    renderConfirmation();

    await userEvent.click(await screen.findByRole('button', { name: /view your orders/i }));
    expect(mockPush).toHaveBeenCalledWith('/account/orders');
  });
});

describe('Instapay step (#134)', () => {
  it('waits for the bag on a refresh instead of sending the shopper to /cart', async () => {
    // Found by the real-Chrome check for #134: the page decided "empty bag"
    // from `loading`, which is false before the bag has been asked for at
    // all — so every hard load of /checkout/instapay bounced to /cart.
    saveCheckoutSession({ guest: GUEST_DETAILS, paymentMethod: 'INSTAPAY' });
    cartAnswers(ACTIVE_CART);

    const { container } = render(
      <CartProvider>
        <InstapayCheckoutPage />
      </CartProvider>,
    );

    await waitFor(() => expect(mockApiGetCart).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(mockReplace).not.toHaveBeenCalledWith('/cart');
  });

  it('still sends a shopper whose bag really is empty back to /cart', async () => {
    saveCheckoutSession({ guest: GUEST_DETAILS, paymentMethod: 'INSTAPAY' });
    cartAnswers(NO_CART);

    render(
      <CartProvider>
        <InstapayCheckoutPage />
      </CartProvider>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/cart'));
  });

  it('remembers the placed order, so the confirmation knows who bought it', async () => {
    saveCheckoutSession({ guest: GUEST_DETAILS, paymentMethod: 'INSTAPAY' });
    cartAnswers(ACTIVE_CART);
    mockApiCheckout.mockResolvedValue(GUEST_ORDER);

    const { container } = render(
      <CartProvider>
        <InstapayCheckoutPage />
      </CartProvider>,
    );

    const input = await waitFor(() => {
      const el = container.querySelector('input[type="file"]');
      if (!el) throw new Error('file input not mounted');
      return el as HTMLInputElement;
    });
    // Wait for the bag, or the page redirects to /cart as empty.
    await waitFor(() => expect(mockApiGetCart).toHaveBeenCalled());
    fireEvent.change(input, {
      target: { files: [new File(['receipt'], 'r.png', { type: 'image/png' })] },
    });
    const submit = await screen.findByRole('button', { name: /submit & place order/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/checkout/confirmation?order=MR-10001'),
    );
    expect(loadPlacedOrder()?.order.orderNumber).toBe('MR-10001');
    expect(loadPlacedOrder()?.idempotencyKey).toBe(mockApiCheckout.mock.calls[0][1]);
  });
});

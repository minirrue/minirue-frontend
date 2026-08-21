import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutDeliveryPage from '@/app/checkout/page';

/**
 * Guest checkout, at the Delivery step (owner, 2026-08-21).
 *
 * Two separate bugs are pinned here, because they produced the same symptom
 * from opposite directions and one masked the other:
 *
 *  1. The page used to `router.replace('/login')` for anyone without a
 *     session. A guest with a full bag met a sign-in wall at the till.
 *
 *  2. Once that redirect was removed, identity was read from
 *     `isAuthenticated()` — the `mr-auth` COOKIE HINT, which is a cache and
 *     survives a session's death. A browser that had signed in once and then
 *     expired was shown the saved-address branch, the address fetch 401'd,
 *     and the shopper sat on "Loading your addresses…" forever. Only a reload
 *     recovered it, because the 401 had cleared the hint by then.
 *
 * So the invariant under test is not "a guest sees a form" — it is "the guest
 * form is chosen by the SERVER's answer about identity, never by the hint".
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
}));

const mockUseUser = jest.fn();
jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => mockUseUser(),
}));

const mockUseCustomerAddresses = jest.fn();
jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerAddresses: () => mockUseCustomerAddresses(),
}));

jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => ({
    cartId: '11111111-1111-4111-8111-111111111111',
    itemCount: 1,
    subtotalAmount: '450.00',
    currency: 'EGP',
  }),
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  // What a dead-but-once-signed-in browser looks like: the identity query has
  // failed, so useUser reports no user. This is exactly the state the cookie
  // hint used to get wrong.
  mockUseUser.mockReturnValue({ data: undefined, isPending: false });
  mockUseCustomerAddresses.mockReturnValue({ data: undefined, isLoading: true });
});

describe('checkout delivery step — guest', () => {
  it('asks a guest for their own details instead of sending them to sign in', async () => {
    render(<CheckoutDeliveryPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // The whole point: no bounce.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('never shows a guest the saved-address branch, even mid-fetch', async () => {
    // useCustomerAddresses is deliberately left "loading" above — the state
    // the old code got stuck in. A guest must not see it at all.
    render(<CheckoutDeliveryPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/loading your addresses/i)).not.toBeInTheDocument();
  });

  it('collects email, phone and a full address — every field the order needs', async () => {
    render(<CheckoutDeliveryPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Named individually rather than counted: the owner asked specifically to
    // be sure the shop holds an email, a phone and an address for every guest
    // sale, and a count would still pass if one were swapped for another.
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^phone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^address$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^city$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^governorate$/i)).toBeInTheDocument();
  });

  it('refuses to continue on an empty form, and says which field is wrong', async () => {
    const user = userEvent.setup();
    render(<CheckoutDeliveryPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Deliberately NOT disabled — a dead button with no stated reason is the
    // exact complaint this shop already had about Add to bag.
    const cta = screen.getByRole('button', { name: /continue to payment/i });
    expect(cta).toBeEnabled();

    await user.click(cta);

    expect(mockPush).not.toHaveBeenCalled();
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
  });

  it('carries a completed form to Payment, and keeps it for the walk back', async () => {
    const user = userEvent.setup();
    render(<CheckoutDeliveryPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/full name/i), 'Volta Joe');
    await user.type(screen.getByLabelText(/^email$/i), 'volta@example.com');
    await user.type(screen.getByLabelText(/^phone$/i), '+201012431350');
    await user.type(screen.getByLabelText(/^address$/i), '12 Nile Street');
    await user.type(screen.getByLabelText(/^city$/i), 'Al Giza');
    await user.type(screen.getByLabelText(/^governorate$/i), 'Giza');

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(mockPush).toHaveBeenCalledWith('/checkout/payment');

    // Persisted, so returning from Payment does not make them type it twice —
    // and so the Payment step can tell Delivery WAS completed. It checks for
    // `guest` where a signed-in shopper leaves `shippingAddressId`; without
    // this the guest is bounced back a step in a loop.
    const saved = JSON.parse(window.sessionStorage.getItem('mr-checkout') ?? '{}');
    expect(saved.guest).toMatchObject({
      fullName: 'Volta Joe',
      email: 'volta@example.com',
      phone: '+201012431350',
      line1: '12 Nile Street',
      city: 'Al Giza',
      governorate: 'Giza',
    });
    expect(saved.shippingAddressId).toBeUndefined();
  });
});

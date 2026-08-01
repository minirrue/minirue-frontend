import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CheckoutDeliveryPage from '@/app/checkout/page';
import CheckoutPaymentPage from '@/app/checkout/payment/page';
import { clearCheckoutSession, saveCheckoutSession } from '@/lib/checkout/checkout-session';

/**
 * W3.5 — each checkout step is its own route with no shared layout, so each
 * remounts from scratch and used to re-derive its own default instead of
 * reading back what was already saved to sessionStorage via
 * saveCheckoutSession. Going back and forward lost the shopper's picks.
 *
 * checkout-session.ts itself is exercised for real (real sessionStorage) —
 * only chrome (CheckoutShell: header/footer/announcement bar) and data
 * hooks unrelated to this bug are mocked.
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
}));

jest.mock('@/lib/auth/tokens', () => ({
  isAuthenticated: () => true,
}));

const mockUseCart = jest.fn();
jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => mockUseCart(),
}));

const mockUseCustomerAddresses = jest.fn();
jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerAddresses: () => mockUseCustomerAddresses(),
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function address(overrides: Partial<{
  id: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  line1: string;
  isDefault: boolean;
}>) {
  return {
    id: 'addr-x',
    customerId: 'cust-1',
    label: 'HOME' as const,
    line1: 'Somewhere',
    line2: null,
    city: 'Cairo',
    governorate: 'Cairo',
    postalCode: null,
    countryCode: 'EG',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const DEFAULT_ADDRESS = address({ id: 'addr-default', label: 'HOME', line1: '1 Nile St', isDefault: true });
const WORK_ADDRESS = address({ id: 'addr-work', label: 'WORK', line1: '2 Tahrir Sq', isDefault: false });

beforeEach(() => {
  clearCheckoutSession();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockUseCart.mockReturnValue({
    cartId: 'cart-1',
    itemCount: 1,
    subtotalAmount: '400.00',
    currency: 'EGP',
    // The real context always carries this; the mock said itemCount: 1 while
    // holding no items, which is a state the cart cannot actually be in. The
    // page now reads `items` for the discount field, so an honest fixture
    // matters — a mock that is impossible in production tests nothing.
    items: [
      {
        id: 'ci-1',
        variantId: '11111111-1111-4111-8111-111111111111',
        qty: 1,
        unitPriceAmount: '400.00',
        unitPriceCurrency: 'EGP',
        lineTotalAmount: '400.00',
        availableQuantity: 5,
      },
    ],
  });
  mockUseCustomerAddresses.mockReturnValue({
    data: [DEFAULT_ADDRESS, WORK_ADDRESS],
    isLoading: false,
  });
});

describe('checkout delivery step (app/checkout/page.tsx)', () => {
  it('preselects the address id saved from a previous pass through this step', async () => {
    saveCheckoutSession({ shippingAddressId: WORK_ADDRESS.id });
    render(<CheckoutDeliveryPage />);

    const workRadio = await screen.findByRole('radio', { name: /tahrir/i });
    await waitFor(() => expect(workRadio).toBeChecked());
  });

  it('falls back to the default address when the saved id no longer exists', async () => {
    saveCheckoutSession({ shippingAddressId: 'addr-deleted-since' });
    render(<CheckoutDeliveryPage />);

    const defaultRadio = await screen.findByRole('radio', { name: /nile/i });
    await waitFor(() => expect(defaultRadio).toBeChecked());
  });

  it('falls back to the default address when the session holds nothing', async () => {
    render(<CheckoutDeliveryPage />);

    const defaultRadio = await screen.findByRole('radio', { name: /nile/i });
    await waitFor(() => expect(defaultRadio).toBeChecked());
  });
});

describe('checkout payment step (app/checkout/payment/page.tsx)', () => {
  it('preselects INSTAPAY when the session says so', async () => {
    saveCheckoutSession({ shippingAddressId: DEFAULT_ADDRESS.id, paymentMethod: 'INSTAPAY' });
    render(<CheckoutPaymentPage />);

    const instapayRadio = await screen.findByRole('radio', { name: /instapay/i });
    await waitFor(() => expect(instapayRadio).toBeChecked());
  });

  it('defaults to COD when the session holds no payment method', async () => {
    saveCheckoutSession({ shippingAddressId: DEFAULT_ADDRESS.id });
    render(<CheckoutPaymentPage />);

    const codRadio = await screen.findByRole('radio', { name: /cash on delivery/i });
    await waitFor(() => expect(codRadio).toBeChecked());
  });
});

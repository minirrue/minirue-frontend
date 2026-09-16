import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import InstapayCheckoutPage from '@/app/checkout/instapay/page';
import { saveCheckoutSession } from '@/lib/checkout/checkout-session';

/**
 * The InstaPay submission path sends `deliveryMethod` / `deliveryLocation`
 * explicitly, straight from the Delivery step's session (frontend#163) —
 * this is the one real JSON `apiCheckout` call this workstream owns (the COD
 * placement in `app/checkout/confirmation/page.tsx` belongs to another
 * workstream and is untouched here).
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
}));

jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => ({
    cartId: '11111111-1111-4111-8111-111111111111',
    items: [{ id: 'i1', variantId: 'v1', qty: 1 }],
    lines: [],
    bundleIndex: new Map(),
    subtotalAmount: '450.00',
    currency: 'EGP',
    hydrated: true,
    clearCart: jest.fn().mockResolvedValue(undefined),
  }),
}));

const mockApiCheckout = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  ...jest.requireActual('@/lib/checkout/checkout-api'),
  apiCheckout: (...args: unknown[]) => mockApiCheckout(...args),
}));

jest.mock('@/lib/api/discounts', () => ({
  ...jest.requireActual('@/lib/api/discounts'),
  previewDiscount: jest.fn().mockResolvedValue({ valid: false, discountMinor: 0 }),
  loadAppliedCode: jest.fn().mockReturnValue(null),
  saveAppliedCode: jest.fn(),
  codeRefusalAtPlacement: jest.fn().mockReturnValue(undefined),
}));

jest.mock('@/components/checkout/InstapayGuide', () => ({
  __esModule: true,
  useInstapayGuide: () => ({
    payLink: 'https://ipn.eg/S/x',
    handle: 'x@instapay',
    qrUrl: '/x.png',
    exampleUrl: '/y.png',
  }),
  default: () => <div>guide</div>,
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/checkout/real-order-total', () => ({
  realOrderTotalMinor: jest.fn().mockResolvedValue(45000),
}));

jest.mock('@/lib/checkout/placed-order', () => ({
  ...jest.requireActual('@/lib/checkout/placed-order'),
  savePlacedOrder: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const ORDER = {
  id: 'order-1',
  orderNumber: 'MR-20001',
  orderSeq: 1,
  status: 'PENDING',
  totalAmount: '450.00',
  totalCurrency: 'EGP',
  createdAt: '2026-09-15T10:00:00.000Z',
  refundedAt: null,
  refundedAmountCents: null,
  items: [],
};

async function uploadReceipt(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'receipt.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => expect(screen.getByAltText(/receipt preview/i)).toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockApiCheckout.mockResolvedValue(ORDER);
});

describe('InstaPay checkout — deliveryMethod / deliveryLocation (frontend#163)', () => {
  it('sends deliveryMethod and deliveryLocation for a SAME_DAY session', async () => {
    saveCheckoutSession({
      guest: {
        fullName: 'Volta Joe',
        email: 'volta@example.com',
        phone: '+201012431350',
        line1: '12 Nile Street',
        city: 'Cairo',
        governorate: 'Cairo',
      },
      paymentMethod: 'INSTAPAY',
      deliveryMethod: 'SAME_DAY',
      deliveryLocation: { lat: 30.05, lng: 31.24 },
    });

    const { container } = render(<InstapayCheckoutPage />);
    await uploadReceipt(container);

    const submit = screen.getByRole('button', { name: /submit & place order/i });
    submit.click();

    await waitFor(() => expect(mockApiCheckout).toHaveBeenCalledTimes(1));
    expect(mockApiCheckout.mock.calls[0][0]).toMatchObject({
      deliveryMethod: 'SAME_DAY',
      deliveryLocation: { lat: 30.05, lng: 31.24 },
    });
  });

  it('sends deliveryMethod STANDARD and no deliveryLocation for a Standard session', async () => {
    saveCheckoutSession({
      guest: {
        fullName: 'Volta Joe',
        email: 'volta@example.com',
        phone: '+201012431350',
        line1: '12 Nile Street',
        city: 'Cairo',
        governorate: 'Cairo',
      },
      paymentMethod: 'INSTAPAY',
      deliveryMethod: 'STANDARD',
    });

    const { container } = render(<InstapayCheckoutPage />);
    await uploadReceipt(container);

    const submit = screen.getByRole('button', { name: /submit & place order/i });
    submit.click();

    await waitFor(() => expect(mockApiCheckout).toHaveBeenCalledTimes(1));
    const body = mockApiCheckout.mock.calls[0][0];
    expect(body.deliveryMethod).toBe('STANDARD');
    expect(body.deliveryLocation).toBeUndefined();
  });
});

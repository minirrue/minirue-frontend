import React from 'react';
import { render, screen } from '@testing-library/react';
import CartDrawer from '@/components/storefront/cart/CartDrawer';

/**
 * The side cart shows the sitewide discount (frontend#83).
 *
 * The drawer rendered a bare Subtotal while the product card struck the price
 * through and the bag applied the markdown, so the first total a shopper saw
 * after "Add to bag" was the higher one.
 */

let mockDrawerOpen = true;
let mockPreview: { discountMinor: number } | null = null;
let mockSavedCode: string | null = null;
const automaticCalls: Array<{ enabled: boolean }> = [];

jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => ({
    lines: [{ key: 'l1', variantId: 'v1', qty: 1, unitPriceAmount: '800.00' }],
    bundleIndex: new Map(),
    subtotalAmount: '800.00',
    currency: 'EGP',
    itemCount: 1,
    loading: false,
    error: null,
    drawerOpen: mockDrawerOpen,
    closeDrawer: jest.fn(),
    setLineQty: jest.fn(),
    removeLine: jest.fn(),
    clearError: jest.fn(),
  }),
}));
jest.mock('@/components/storefront/cart/CartItemRow', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/storefront/cart/bag-lines', () => ({ toPricingLines: () => [{ variantId: 'v1', qty: 1 }] }));
jest.mock('@/components/storefront/cart/use-bag-pricing', () => ({
  useAutomaticDiscount: (_lines: unknown, enabled: boolean) => {
    automaticCalls.push({ enabled });
    return enabled ? mockPreview : null;
  },
}));
jest.mock('@/lib/api/discounts', () => ({ loadAppliedCode: () => mockSavedCode }));

beforeEach(() => {
  mockDrawerOpen = true;
  mockPreview = null;
  mockSavedCode = null;
  automaticCalls.length = 0;
});

describe('CartDrawer sitewide discount', () => {
  it('shows the discount and the total after it when a sitewide offer applies', () => {
    mockPreview = { discountMinor: 8_000 };
    render(<CartDrawer />);

    const row = screen.getByTestId('drawer-sitewide-discount');
    expect(row).toHaveTextContent(/sitewide discount/i);
    expect(row).toHaveTextContent('80');
    expect(screen.getByText(/total before shipping/i)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/720/);
  });

  it('shows only the subtotal when no offer is running', () => {
    render(<CartDrawer />);

    expect(screen.queryByTestId('drawer-sitewide-discount')).not.toBeInTheDocument();
    expect(screen.getByText(/subtotal/i)).toBeInTheDocument();
  });

  it('does not spend the throttled preview while the drawer is closed', () => {
    mockDrawerOpen = false;
    render(<CartDrawer />);

    expect(automaticCalls.every((c) => c.enabled === false)).toBe(true);
  });

  it('defers to the bag when a discount code is saved, instead of showing a second figure', () => {
    mockSavedCode = 'MINIRUE10';
    mockPreview = { discountMinor: 8_000 };
    render(<CartDrawer />);

    expect(screen.queryByTestId('drawer-sitewide-discount')).not.toBeInTheDocument();
    expect(screen.getByText(/discount code is applied in your bag/i)).toBeInTheDocument();
  });
});

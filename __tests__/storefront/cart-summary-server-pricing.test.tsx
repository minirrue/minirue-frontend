import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { DiscountPreview } from '@/lib/api/discounts';

/**
 * #36 and #38 in the one block they both land in: the order summary.
 *
 * The bag quoted a shopper EGP 799 for an item the product page had just
 * struck through to EGP 719.10, with no discount row to explain the gap, and
 * added a shipping fee nailed into the bundle rather than the one the admin
 * saved.
 *
 * What these assert is not "the arithmetic is right" — that is covered in
 * __tests__/checkout/cart-shipping-policy.test.ts. It is that the summary uses
 * the SERVER's answer for both figures: the discount comes from
 * `POST /v1/discounts/preview` (the same `priceBag()` checkout runs, asked with
 * a null code so the automatic offer is included), and the fee comes from the
 * shop's settings. A regression here looks like the discount row quietly
 * disappearing again.
 */

const previewDiscount = jest.fn();
const loadShippingPolicy = jest.fn();
let appliedCode: string | null = null;

jest.mock('@/lib/api/discounts', () => ({
  previewDiscount: (...args: unknown[]) => previewDiscount(...args),
  loadAppliedCode: () => appliedCode,
  saveAppliedCode: (code: string | null) => {
    appliedCode = code;
  },
}));

jest.mock('@/lib/api/settings', () => ({
  loadShippingPolicy: (...args: unknown[]) => loadShippingPolicy(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), prefetch: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ mobile: false, tablet: false, desktop: true }),
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/checkout/CheckoutSteps', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/analytics/track', () => ({ track: jest.fn() }));

const cart = {
  items: [] as Array<Record<string, unknown>>,
  subtotalAmount: '0.00',
  currency: 'EGP',
  itemCount: 0,
  loading: false,
  error: null as string | null,
  updateQty: jest.fn(),
  removeItem: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => cart,
}));

import CartPage from '@/app/cart/page';
import { resetBagPricingCaches } from '@/components/storefront/cart/use-bag-pricing';

/** The bag from the issue: one BLACK OPIUM at EGP 799. */
function bagOf(unitPriceAmount: string, qty = 1) {
  return [
    {
      id: 'line-1',
      variantId: 'variant-1',
      qty,
      unitPriceAmount,
      unitPriceCurrency: 'EGP',
      lineTotalAmount: (parseFloat(unitPriceAmount) * qty).toFixed(2),
      name: 'BLACK OPIUM EAU DE PARFUM',
    },
  ];
}

function preview(over: Partial<DiscountPreview> = {}): DiscountPreview {
  return {
    valid: false,
    code: null,
    discountMinor: 0,
    eligibleSubtotalMinor: 0,
    appliesToMinirueOnly: false,
    winner: null,
    bundleSavingsMinor: 0,
    message: null,
    ...over,
  };
}

/** The text of the summary row whose label is `label`. */
function rowText(label: string): string {
  const cell = screen.getByText(label);
  return cell.parentElement?.textContent ?? '';
}

beforeEach(() => {
  jest.useFakeTimers();
  appliedCode = null;
  previewDiscount.mockReset();
  loadShippingPolicy.mockReset();
  loadShippingPolicy.mockResolvedValue({ flatMinor: 5_000, freeOverMinor: 0 });
  resetBagPricingCaches();
  cart.items = [];
  cart.subtotalAmount = '0.00';
  cart.itemCount = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Render, then let the debounce and both in-flight reads settle.
 *
 * The automatic preview is debounced hard on purpose — the endpoint allows 10
 * requests per 10 minutes per IP — so nothing about the discount is on screen
 * until the timer fires.
 */
async function renderSettled() {
  render(<CartPage />);
  await waitFor(() => expect(screen.getByText('Subtotal')).toBeInTheDocument());
  await act(async () => {
    jest.runAllTimers();
  });
}

describe('the cart summary (#36 — the sitewide discount)', () => {
  it('shows a discount row priced by the server when a markdown is running', async () => {
    cart.items = bagOf('799.00');
    cart.subtotalAmount = '799.00';
    cart.itemCount = 1;
    previewDiscount.mockResolvedValue(
      preview({ discountMinor: 7_990, winner: 'AUTOMATIC', eligibleSubtotalMinor: 79_900 }),
    );

    await renderSettled();

    // 799 − 79.90 is the 719.10 the product page promised.
    expect(rowText('Discount')).toMatch(/79\.90/);
    expect(rowText('Estimated total')).toMatch(/769\.10/); // + EGP 50 delivery
  });

  it('asks for the automatic offer with a null code', async () => {
    cart.items = bagOf('799.00');
    cart.subtotalAmount = '799.00';
    cart.itemCount = 1;
    previewDiscount.mockResolvedValue(preview({ discountMinor: 7_990, winner: 'AUTOMATIC' }));

    await renderSettled();

    // Null, not "" and not omitted: the server folds the live markdown in for
    // a codeless bag, which is the whole reason this endpoint can answer #36.
    expect(previewDiscount).toHaveBeenCalledWith(
      [{ variantId: 'variant-1', qty: 1, unitPriceMinor: 79_900 }],
      null,
    );
  });

  it('shows no discount row when nothing is running', async () => {
    cart.items = bagOf('799.00');
    cart.subtotalAmount = '799.00';
    cart.itemCount = 1;
    previewDiscount.mockResolvedValue(preview());

    await renderSettled();

    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
    expect(rowText('Estimated total')).toMatch(/849/);
  });

  it('leaves the total alone when the preview fails', async () => {
    // Throttled (10 per 10 minutes), offline, or an older backend. The summary
    // reverts to what it showed before this existed rather than breaking — and
    // the server still applies the markdown at Place order.
    cart.items = bagOf('799.00');
    cart.subtotalAmount = '799.00';
    cart.itemCount = 1;
    previewDiscount.mockRejectedValue(new Error('429'));

    await renderSettled();

    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
    expect(rowText('Estimated total')).toMatch(/849/);
  });

  it('does not spend a request on the automatic offer while a saved code is being re-checked', async () => {
    // A coded preview already returns max(code, automatic) with a winner, so
    // running both would cost two of ten requests to learn one number.
    appliedCode = 'MINIRUE-K7P2X4';
    cart.items = bagOf('799.00');
    cart.subtotalAmount = '799.00';
    cart.itemCount = 1;
    previewDiscount.mockResolvedValue(
      preview({ valid: true, code: 'MINIRUE-K7P2X4', discountMinor: 10_000, winner: 'CODE' }),
    );

    await renderSettled();

    expect(previewDiscount).toHaveBeenCalledTimes(1);
    expect(previewDiscount).toHaveBeenCalledWith(expect.anything(), 'MINIRUE-K7P2X4');
  });
});

describe('the cart summary (#38 — the admin-configured delivery fee)', () => {
  it('shows the flat rate the dashboard saved, not the old constant', async () => {
    loadShippingPolicy.mockResolvedValue({ flatMinor: 8_000, freeOverMinor: 0 });
    cart.items = bagOf('799.00');
    cart.subtotalAmount = '799.00';
    cart.itemCount = 1;
    previewDiscount.mockResolvedValue(preview());

    await renderSettled();

    expect(rowText('Shipping')).toMatch(/80/);
    expect(rowText('Shipping')).not.toMatch(/50/);
    expect(rowText('Estimated total')).toMatch(/879/);
  });

  it('says Free above the threshold, in the words the product page uses', async () => {
    loadShippingPolicy.mockResolvedValue({ flatMinor: 5_000, freeOverMinor: 300_000 });
    cart.items = bagOf('3000.00');
    cart.subtotalAmount = '3000.00';
    cart.itemCount = 1;
    previewDiscount.mockResolvedValue(preview());

    await renderSettled();

    // Not "EGP 0" — the PDP promises "Complimentary shipping over EGP 3,000",
    // and a zero priced out in full reads as the threshold having failed.
    expect(rowText('Shipping')).toMatch(/Free/);
    expect(rowText('Estimated total')).toMatch(/3,000/);
  });

  it('keeps free delivery once a discount takes the bag under the threshold', async () => {
    // The backend's default freeShippingBasis is BEFORE_DISCOUNT. Taking free
    // delivery back the instant a markdown applies reads as a bug.
    loadShippingPolicy.mockResolvedValue({ flatMinor: 5_000, freeOverMinor: 300_000 });
    cart.items = bagOf('3000.00');
    cart.subtotalAmount = '3000.00';
    cart.itemCount = 1;
    previewDiscount.mockResolvedValue(
      preview({ discountMinor: 30_000, winner: 'AUTOMATIC' }),
    );

    await renderSettled();

    expect(rowText('Shipping')).toMatch(/Free/);
    expect(rowText('Estimated total')).toMatch(/2,700/);
  });
});

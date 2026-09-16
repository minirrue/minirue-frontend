import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CartProvider, useCart } from '@/components/storefront/cart/CartContext';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';
import SearchSheet from '@/components/layout/SearchSheet';
import CheckoutConfirmationPage from '@/app/checkout/confirmation/page';
import { saveCheckoutSession, clearCheckoutSession } from '@/lib/checkout/checkout-session';
import { saveAppliedCode } from '@/lib/api/discounts';
import { PRODUCT_FIXTURE, IN_STOCK_VARIANT } from '../storefront/fixtures/product';
import type { CartDto } from '@/lib/api/cart';

/**
 * Lane 13 — every commerce-semantic call site this lane wired up, checked
 * against the behaviour the brief calls out by name:
 *   - a successful add fires exactly one `add_to_cart`; a failed one fires none
 *   - `product_view` fires once even under a StrictMode double-mount
 *   - a grid impression fires once per product even if the observer reports twice
 *   - a typed search query is one `search` event, not one per keystroke
 *   - the confirmation page never fires `purchase` (server-emitted only)
 *
 * `lib/analytics/track` is mocked everywhere below — this suite is about
 * WHETHER and WHAT gets tracked, not the transport/queue underneath it
 * (already covered by __tests__/analytics/track.test.ts et al).
 */

const mockTrack = jest.fn();
jest.mock('@/lib/analytics/track', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/',
}));

// Only `catalog.search` is faked — every other export (mediaImageUrl,
// primaryMedia, lowestPrice, productByline, variantInStock, …) is the real
// implementation, since ApiProductDetail/CatalogProductCard depend on it to
// render at all.
const mockCatalogSearch = jest.fn();
jest.mock('@/lib/api/catalog', () => {
  const actual = jest.requireActual('@/lib/api/catalog');
  return {
    ...actual,
    catalog: { ...actual.catalog, search: (...args: unknown[]) => mockCatalogSearch(...args) },
  };
});

const EMPTY_CART_DTO: CartDto = {
  id: '',
  status: 'ACTIVE',
  currency: 'EGP',
  items: [],
  totals: { subtotalAmount: '0.00', currency: 'EGP', itemCount: 0, uniqueItemCount: 0 },
  expiresAt: null,
};

const mockApiGetCart = jest.fn();
const mockApiAddItem = jest.fn();
const mockApiAddBundle = jest.fn();
jest.mock('@/lib/api/cart', () => ({
  ...jest.requireActual('@/lib/api/cart'),
  apiGetCart: (...args: unknown[]) => mockApiGetCart(...args),
  apiAddItem: (...args: unknown[]) => mockApiAddItem(...args),
  apiAddBundle: (...args: unknown[]) => mockApiAddBundle(...args),
  apiUpdateItem: jest.fn(),
  apiRemoveItem: jest.fn(),
  apiClearCart: jest.fn(),
  // Always "identified" so CartProvider's hydrateCart always calls the
  // (mocked) apiGetCart above, rather than silently skipping it as an
  // unidentified guest — every test below needs a predictable cart.
  getCartSessionId: () => 'sess-test',
}));

const mockApiCheckout = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  apiCheckout: (...args: unknown[]) => mockApiCheckout(...args),
}));

const mockLoadShippingPolicy = jest.fn();
jest.mock('@/lib/api/settings', () => ({
  ...jest.requireActual('@/lib/api/settings'),
  loadShippingPolicy: (...args: unknown[]) => mockLoadShippingPolicy(...args),
}));

const mockPreviewDiscount = jest.fn();
jest.mock('@/lib/api/discounts', () => ({
  ...jest.requireActual('@/lib/api/discounts'),
  previewDiscount: (...args: unknown[]) => mockPreviewDiscount(...args),
}));

const mockUseDiscountedPrice = jest.fn();
jest.mock('@/lib/hooks/use-sitewide-discount', () => ({
  ...jest.requireActual('@/lib/hooks/use-sitewide-discount'),
  useDiscountedPrice: (...args: unknown[]) => mockUseDiscountedPrice(...args),
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockTrack.mockClear();
  mockCatalogSearch.mockReset();
  mockApiGetCart.mockReset().mockResolvedValue(EMPTY_CART_DTO);
  mockApiAddItem.mockReset();
  mockApiAddBundle.mockReset();
  mockApiCheckout.mockReset();
  mockLoadShippingPolicy.mockReset().mockResolvedValue({ flatMinor: 5000, freeOverMinor: 0 });
  mockPreviewDiscount.mockReset().mockResolvedValue({
    valid: false,
    code: null,
    discountMinor: 0,
    eligibleSubtotalMinor: 0,
    appliesToMinirueOnly: false,
    winner: null,
    bundleSavingsMinor: 0,
    message: null,
  });
  // Pass-through by default — the same behaviour every OTHER test in this
  // file relies on. Overridden per-test where the discounted price matters.
  mockUseDiscountedPrice.mockReset().mockImplementation((amount: string) => ({ amount }));
});

// ── add_to_cart ──────────────────────────────────────────────────────────────

describe('CartContext — add_to_cart', () => {
  function AddButton() {
    const { addItem } = useCart();
    return (
      <button onClick={() => void addItem('variant-1', 2, { productId: 'product-1' }, 'pdp')}>
        add
      </button>
    );
  }

  function renderCart() {
    return render(
      <CartProvider>
        <AddButton />
      </CartProvider>,
    );
  }

  it('fires exactly one add_to_cart, with the registered shape, after a successful add', async () => {
    mockApiAddItem.mockResolvedValue({
      id: 'cart-1',
      status: 'ACTIVE',
      currency: 'EGP',
      items: [
        {
          id: 'item-1',
          variantId: 'variant-1',
          qty: 2,
          unitPriceAmount: '400.00',
          unitPriceCurrency: 'EGP',
          lineTotalAmount: '800.00',
        },
      ],
      totals: { subtotalAmount: '800.00', currency: 'EGP', itemCount: 2, uniqueItemCount: 1 },
      expiresAt: null,
    });

    renderCart();
    await userEvent.click(screen.getByRole('button', { name: 'add' }));

    await waitFor(() => {
      expect(mockTrack.mock.calls.filter(([name]) => name === 'add_to_cart')).toHaveLength(1);
    });

    const [, props] = mockTrack.mock.calls.find(([name]) => name === 'add_to_cart')!;
    expect(props).toEqual({
      productId: 'product-1',
      variantId: 'variant-1',
      qty: 2,
      priceMinor: 40000,
      source: 'pdp',
    });
  });

  it('fires no add_to_cart when the API call fails — a failed add is not an add', async () => {
    mockApiAddItem.mockRejectedValue(new Error('network down'));

    renderCart();
    await userEvent.click(screen.getByRole('button', { name: 'add' }));

    await waitFor(() => expect(mockApiAddItem).toHaveBeenCalled());
    expect(mockTrack.mock.calls.some(([name]) => name === 'add_to_cart')).toBe(false);
  });
});

// ── add_to_cart for a set (#142) ─────────────────────────────────────────────

describe('CartContext — add_to_cart for a set line', () => {
  function AddBundleButton() {
    const { addBundle } = useCart();
    return <button onClick={() => void addBundle('gift-set')}>add set</button>;
  }

  function renderCart() {
    return render(
      <CartProvider>
        <AddBundleButton />
      </CartProvider>,
    );
  }

  it('fires add_to_cart with the bundleId once a set is added — it used to fire nothing', async () => {
    // Two member rows, both stamped with the set's bundleId, exactly as the
    // backend writes a set into the cart (bag-lines.ts's own description of
    // `CartItemDto`).
    mockApiAddBundle.mockResolvedValue({
      id: 'cart-1',
      status: 'ACTIVE',
      currency: 'EGP',
      items: [
        {
          id: 'item-1',
          variantId: 'variant-a',
          qty: 1,
          unitPriceAmount: '300.00',
          unitPriceCurrency: 'EGP',
          lineTotalAmount: '300.00',
          bundleId: 'bundle-1',
          bundleLineKey: 'add-1',
        },
        {
          id: 'item-2',
          variantId: 'variant-b',
          qty: 1,
          unitPriceAmount: '250.00',
          unitPriceCurrency: 'EGP',
          lineTotalAmount: '250.00',
          bundleId: 'bundle-1',
          bundleLineKey: 'add-1',
        },
      ],
      totals: { subtotalAmount: '550.00', currency: 'EGP', itemCount: 2, uniqueItemCount: 2 },
      expiresAt: null,
    });

    renderCart();
    await userEvent.click(screen.getByRole('button', { name: 'add set' }));

    await waitFor(() => {
      expect(mockTrack.mock.calls.filter(([name]) => name === 'add_to_cart')).toHaveLength(1);
    });

    const [, props] = mockTrack.mock.calls.find(([name]) => name === 'add_to_cart')!;
    expect(props).toEqual({
      productId: 'bundle-1',
      variantId: 'bundle-1',
      qty: 1,
      priceMinor: 55000,
      source: 'pdp',
    });
  });
});

// ── product_view ─────────────────────────────────────────────────────────────

describe('ApiProductDetail — product_view', () => {
  it('fires exactly once even under a React StrictMode double-mount', () => {
    renderWithQueryClient(
      <React.StrictMode>
        <ApiProductDetail
          product={PRODUCT_FIXTURE}
          perks={[]}
          onBack={() => {}}
          onAddToBag={() => {}}
        />
      </React.StrictMode>,
    );

    const calls = mockTrack.mock.calls.filter(([name]) => name === 'product_view');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ productId: PRODUCT_FIXTURE.id });
  });

  it('sends the DISPLAYED price, after a markdown — never the list price (#142)', () => {
    // The default variant (IN_STOCK_VARIANT) lists at "400". A running
    // markdown drops what is actually shown to "250" — `useDiscountedPrice`
    // is the one source of that figure everywhere else on this page (the
    // panel's own `shownPrice`, the sticky bar, VariantPicker), so
    // product_view has to read the same answer rather than the variant's
    // raw `priceAmount`.
    mockUseDiscountedPrice.mockImplementation((amount: string) =>
      amount === IN_STOCK_VARIANT.priceAmount ? { amount: '250.00', wasAmount: amount } : { amount },
    );

    renderWithQueryClient(
      <ApiProductDetail
        product={PRODUCT_FIXTURE}
        perks={[]}
        onBack={() => {}}
        onAddToBag={() => {}}
      />,
    );

    const calls = mockTrack.mock.calls.filter(([name]) => name === 'product_view');
    expect(calls).toHaveLength(1);
    // 250.00 EGP, not the list price's 40000 (400.00 EGP).
    expect(calls[0][1]).toMatchObject({ priceMinor: 25000 });
  });
});

// ── product_impression ───────────────────────────────────────────────────────

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly thresholds: number[] = [];
  observed: Element[] = [];
  constructor(private cb: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve(el: Element) {
    this.observed = this.observed.filter((o) => o !== el);
  }
  disconnect() {
    this.observed = [];
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  fire(el: Element, isIntersecting: boolean) {
    this.cb(
      [{ isIntersecting, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

describe('CatalogProductGrid — product_impression', () => {
  const originalIO = global.IntersectionObserver;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      MockIntersectionObserver;
  });

  afterEach(() => {
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = originalIO;
  });

  it('fires product_impression once per product even when the observer reports twice', () => {
    const products = [PRODUCT_FIXTURE, { ...PRODUCT_FIXTURE, id: 'product-two', slug: 'no2' }];
    render(
      <CatalogProductGrid
        products={products}
        listTraceId="PG-TEST-001::EL-LIST-grid"
        cardTraceIdPrefix="PG-TEST-001::EL-CARD-card"
      />,
    );

    // Not necessarily instances[0] — next/image sets up its own
    // IntersectionObserver per <Image>, and those (being descendants) mount
    // before this grid's own tracking effect does. Find the one actually
    // observing our marker elements.
    const observer = MockIntersectionObserver.instances.find((o) =>
      o.observed.some((el) => el.hasAttribute('data-mr-impression-id')),
    );
    expect(observer).toBeDefined();
    const target = observer!.observed.find((el) => el.hasAttribute('data-mr-impression-id'))!;

    act(() => {
      observer!.fire(target, true);
      observer!.fire(target, true); // the observer reporting twice for the same card
    });

    const impressions = mockTrack.mock.calls.filter(([name]) => name === 'product_impression');
    expect(impressions).toHaveLength(1);
    expect(impressions[0][1]).toMatchObject({ productId: PRODUCT_FIXTURE.id, position: 0 });
  });
});

// ── search ───────────────────────────────────────────────────────────────────

describe('SearchSheet — debounced search', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCatalogSearch.mockResolvedValue({ data: [], meta: { cursor: null, total: 3, hasMore: false } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires exactly one search event for a whole typed query, not one per keystroke', async () => {
    render(<SearchSheet open onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/search minirue/i);

    // Simulates rapid keystrokes without real per-key delay — each change
    // clears the previous debounce timer, same as fast typing would.
    fireEvent.change(input, { target: { value: 'r' } });
    fireEvent.change(input, { target: { value: 'ro' } });
    fireEvent.change(input, { target: { value: 'ros' } });
    fireEvent.change(input, { target: { value: 'rose' } });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    // Flush the microtask queue so catalog.search's resolved promise settles.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockCatalogSearch).toHaveBeenCalledTimes(1);
    expect(mockCatalogSearch).toHaveBeenCalledWith('rose');

    const searchCalls = mockTrack.mock.calls.filter(([name]) => name === 'search');
    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0][1]).toEqual({ q: 'rose', results: 3 });
  });
});

// ── purchase must never be client-emitted ────────────────────────────────────

describe('checkout confirmation — purchase is never fired from the browser', () => {
  // Mounted directly under a brand-new CartProvider. This used to wait for a
  // hydrated cartId first, on the belief that an unhydrated bag hitting the
  // "your bag is empty" guard was a harness race and not real behaviour. It
  // was real: it is what every refresh of step 4 does (#121). The page now
  // waits for the bag itself — see __tests__/checkout/confirmation-refresh.
  beforeEach(() => {
    sessionStorage.clear();
    clearCheckoutSession();
    saveCheckoutSession({ shippingAddressId: 'addr-1', paymentMethod: 'COD', deliveryMethod: 'STANDARD' });
    mockApiGetCart.mockResolvedValue({
      id: 'cart-1',
      status: 'ACTIVE',
      currency: 'EGP',
      items: [{ id: 'item-1', variantId: 'variant-1', qty: 1, unitPriceAmount: '400.00', unitPriceCurrency: 'EGP', lineTotalAmount: '400.00' }],
      totals: { subtotalAmount: '400.00', currency: 'EGP', itemCount: 1, uniqueItemCount: 1 },
      expiresAt: null,
    });
    mockApiCheckout.mockResolvedValue({ orderNumber: 'ORD-100' });
  });

  afterEach(() => {
    clearCheckoutSession();
  });

  it('never tracks `purchase`, even after a completed order — only payment_initiated', async () => {
    render(
      <CartProvider>
        <CheckoutConfirmationPage />
      </CartProvider>,
    );

    await screen.findByText(/order confirmed/i);

    expect(mockTrack.mock.calls.some(([name]) => name === 'purchase')).toBe(false);
    expect(mockTrack.mock.calls.some(([name]) => name === 'payment_initiated')).toBe(true);
  });
});

// ── payment_initiated total (#142) ───────────────────────────────────────────

describe('checkout confirmation — payment_initiated.totalMinor is the real order total', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearCheckoutSession();
    window.localStorage.clear();
    saveCheckoutSession({ shippingAddressId: 'addr-1', paymentMethod: 'COD', deliveryMethod: 'STANDARD' });
    saveAppliedCode('SAVE30');
    mockApiGetCart.mockResolvedValue({
      id: 'cart-1',
      status: 'ACTIVE',
      currency: 'EGP',
      items: [{ id: 'item-1', variantId: 'variant-1', qty: 1, unitPriceAmount: '400.00', unitPriceCurrency: 'EGP', lineTotalAmount: '400.00' }],
      totals: { subtotalAmount: '400.00', currency: 'EGP', itemCount: 1, uniqueItemCount: 1 },
      expiresAt: null,
    });
    mockApiCheckout.mockResolvedValue({ orderNumber: 'ORD-100' });
    // The real flat rate (EGP 100), not the EGP 50 fallback `orderTotalMinor`
    // falls back to with no options.
    mockLoadShippingPolicy.mockResolvedValue({ flatMinor: 10000, freeOverMinor: 0 });
    mockPreviewDiscount.mockResolvedValue({
      valid: true,
      code: 'SAVE30',
      discountMinor: 3000,
      eligibleSubtotalMinor: 40000,
      appliesToMinirueOnly: false,
      winner: 'CODE',
      bundleSavingsMinor: 0,
      message: null,
    });
  });

  afterEach(() => {
    clearCheckoutSession();
    window.localStorage.clear();
  });

  it('is subtotal − discount + the real shipping fee, not subtotal + the EGP 50 fallback', async () => {
    render(
      <CartProvider>
        <CheckoutConfirmationPage />
      </CartProvider>,
    );

    await screen.findByText(/order confirmed/i);

    await waitFor(() => {
      expect(mockTrack.mock.calls.some(([name]) => name === 'payment_initiated')).toBe(true);
    });

    const [, props] = mockTrack.mock.calls.find(([name]) => name === 'payment_initiated')!;
    // 40000 (subtotal) − 3000 (discount) + 10000 (real fee) = 47000.
    // The old code sent 40000 + 5000 (default fallback, no discount) = 45000.
    expect(props).toMatchObject({ totalMinor: 47000 });
    expect(mockLoadShippingPolicy).toHaveBeenCalled();
    expect(mockPreviewDiscount).toHaveBeenCalledWith(expect.anything(), 'SAVE30');
  });
});

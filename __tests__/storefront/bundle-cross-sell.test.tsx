import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import BundleCrossSell, {
  BundleCrossSellSection,
  bundlesForProduct,
  MAX_SETS,
} from '@/components/storefront/BundleCrossSell';
import type { Bundle, BundleMember } from '@/lib/api/bundles';
import type { BundleIndex } from '@/components/storefront/cart/bag-lines';
import { listBundles } from '@/lib/api/bundles';
import { resetBundleCatalogCache } from '@/components/storefront/cart/use-bundle-catalog';

/**
 * "Also part of these sets" — the PDP cross-sell (#60).
 *
 * The two things this file exists to hold still:
 *
 *  1. **Membership comes from `GET /v1/bundles` and nothing else.** No field
 *     was added to the cached product payload, so the only way this section
 *     can know which sets a product belongs to is by filtering the bundle
 *     index on `members[].productId`. `bundlesForProduct` is that filter.
 *  2. **A product in no set leaves nothing behind.** Not an empty heading, not
 *     a rule, not padding — the owner's page must look exactly as it did.
 */

jest.mock('@/lib/api/bundles', () => ({
  ...jest.requireActual('@/lib/api/bundles'),
  listBundles: jest.fn(),
}));

const mockListBundles = listBundles as jest.MockedFunction<typeof listBundles>;

const PRODUCT_IN_A_SET = 'p-shampoo';
const PRODUCT_IN_NO_SET = 'p-lonely';

function member(productId: string): BundleMember {
  return {
    productId,
    variantId: null,
    productName: productId,
    productSlug: productId,
    categorySlug: 'haircare',
    brandName: 'Karseell',
    quantity: 1,
    unitMinor: 80000,
    allocatedMinor: 80000,
  };
}

function bundle(over: Partial<Bundle> & Pick<Bundle, 'id'>): Bundle {
  return {
    slug: `${over.id}-slug`,
    name: `Set ${over.id}`,
    description: null,
    imageUrl: 'https://img.example/set.jpg',
    priceMinor: 160000,
    currency: 'EGP',
    listTotalMinor: 170000,
    savingMinor: 10000,
    inStock: true,
    members: [member(PRODUCT_IN_A_SET)],
    ...over,
  };
}

function indexOf(...bundles: Bundle[]): BundleIndex {
  return new Map(bundles.map((b) => [b.id, b]));
}

// ── The rule ────────────────────────────────────────────────────────────────

describe('bundlesForProduct', () => {
  it('finds the sets whose members include the product, and only those', () => {
    const inIt = bundle({ id: 'a' });
    const notInIt = bundle({ id: 'b', members: [member('p-other')] });

    expect(bundlesForProduct(indexOf(inIt, notInIt), PRODUCT_IN_A_SET)).toEqual([inIt]);
    expect(bundlesForProduct(indexOf(inIt, notInIt), PRODUCT_IN_NO_SET)).toEqual([]);
  });

  it('matches on productId, never on the slug or the name', () => {
    // A set whose member happens to share the SLUG but not the id must not
    // match — ids are what the bundle and the catalogue actually agree on.
    const decoy = bundle({
      id: 'decoy',
      members: [{ ...member('some-other-id'), productSlug: PRODUCT_IN_A_SET }],
    });
    expect(bundlesForProduct(indexOf(decoy), PRODUCT_IN_A_SET)).toEqual([]);
  });

  it('orders by biggest saving first', () => {
    const small = bundle({ id: 'small', savingMinor: 5000 });
    const big = bundle({ id: 'big', savingMinor: 29900 });
    const middle = bundle({ id: 'middle', savingMinor: 10000 });

    expect(
      bundlesForProduct(indexOf(small, big, middle), PRODUCT_IN_A_SET).map((b) => b.id),
    ).toEqual(['big', 'middle', 'small']);
  });

  it('puts a set that cannot be bought last, however large its saving', () => {
    const richButGone = bundle({ id: 'gone', savingMinor: 99000, inStock: false });
    const modestButHere = bundle({ id: 'here', savingMinor: 1000, inStock: true });

    expect(
      bundlesForProduct(indexOf(richButGone, modestButHere), PRODUCT_IN_A_SET).map((b) => b.id),
    ).toEqual(['here', 'gone']);
  });

  it('keeps an out-of-stock set rather than hiding it — the bundle pages show it too', () => {
    const gone = bundle({ id: 'gone', inStock: false });
    expect(bundlesForProduct(indexOf(gone), PRODUCT_IN_A_SET)).toEqual([gone]);
  });

  it('is deterministic when saving and price tie', () => {
    const b1 = bundle({ id: '1', name: 'Zephyr set' });
    const b2 = bundle({ id: '2', name: 'Amber set' });
    const forwards = bundlesForProduct(indexOf(b1, b2), PRODUCT_IN_A_SET).map((b) => b.name);
    const backwards = bundlesForProduct(indexOf(b2, b1), PRODUCT_IN_A_SET).map((b) => b.name);
    expect(forwards).toEqual(['Amber set', 'Zephyr set']);
    expect(backwards).toEqual(forwards);
  });

  it('caps the rail', () => {
    const many = Array.from({ length: MAX_SETS + 4 }, (_, i) =>
      bundle({ id: `s${i}`, savingMinor: 1000 * (i + 1) }),
    );
    expect(bundlesForProduct(indexOf(...many), PRODUCT_IN_A_SET)).toHaveLength(MAX_SETS);
  });
});

// ── The markup ──────────────────────────────────────────────────────────────

describe('BundleCrossSellSection', () => {
  it('renders nothing at all — not an empty heading — with no sets', () => {
    const { container } = render(<BundleCrossSellSection bundles={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/also part of these sets/i)).not.toBeInTheDocument();
  });

  it('shows the set photo, name, set price and the saving line from the bundle page', () => {
    render(<BundleCrossSellSection bundles={[bundle({ id: 'a', name: 'Karseell Duo' })]} />);

    expect(screen.getByRole('heading', { name: /also part of these sets/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Karseell Duo' })).toBeInTheDocument();
    expect(screen.getByText('1600.00 EGP')).toBeInTheDocument();
    expect(
      screen.getByText(/Instead of 1700\.00 EGP bought separately — you save 100\.00 EGP\./),
    ).toBeInTheDocument();
  });

  it('links each card to the set', () => {
    render(<BundleCrossSellSection bundles={[bundle({ id: 'a', slug: 'karseell-duo' })]} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/bundles/karseell-duo');
  });

  it('labels a set that cannot be bought, matching the bundle page', () => {
    render(<BundleCrossSellSection bundles={[bundle({ id: 'a', inStock: false })]} />);
    expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
  });

  it('says nothing about a saving when there is none', () => {
    render(
      <BundleCrossSellSection
        bundles={[bundle({ id: 'a', savingMinor: 0, listTotalMinor: 160000 })]}
      />,
    );
    expect(screen.queryByText(/you save/i)).not.toBeInTheDocument();
  });

  it('offers the whole set catalogue only when the rail was truncated', () => {
    const { rerender } = render(<BundleCrossSellSection bundles={[bundle({ id: 'a' })]} />);
    expect(screen.queryByRole('link', { name: /all sets/i })).not.toBeInTheDocument();

    rerender(<BundleCrossSellSection bundles={[bundle({ id: 'a' })]} truncated />);
    expect(screen.getByRole('link', { name: /all sets/i })).toHaveAttribute('href', '/bundles');
  });

  /**
   * The LCP guard, asserted on the DOM rather than trusted to a comment.
   *
   * This page's largest paint is the carousel photograph (#7, ~3.7s). Every
   * image in this rail must be lazy so it is neither fetched early nor
   * eligible as an LCP candidate. `next/image` emits `loading="lazy"` for any
   * image without `priority`, so the assertion is that no card image ever
   * carries `priority`/`loading="eager"`/`fetchpriority="high"`.
   */
  it('renders every card image lazily and none of them eagerly', () => {
    render(
      <BundleCrossSellSection
        bundles={[bundle({ id: 'a' }), bundle({ id: 'b' }), bundle({ id: 'c' })]}
      />,
    );
    const imgs = Array.from(document.querySelectorAll('img'));
    expect(imgs).toHaveLength(3);
    for (const img of imgs) {
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img.getAttribute('fetchpriority')).not.toBe('high');
    }
  });
});

// ── The wiring ──────────────────────────────────────────────────────────────

describe('BundleCrossSell', () => {
  beforeEach(() => {
    resetBundleCatalogCache();
    mockListBundles.mockReset();
  });

  it('does not fetch the set catalogue until the end of the page is approached', async () => {
    mockListBundles.mockResolvedValue([bundle({ id: 'a' })]);

    // jest.setup's IntersectionObserver is a no-op that never reports, so the
    // sentinel is never "near" — which is precisely the state of a shopper who
    // has not scrolled, and the request must not happen.
    render(<BundleCrossSell productId={PRODUCT_IN_A_SET} />);

    expect(mockListBundles).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bundle-cross-sell')).not.toBeInTheDocument();
  });

  it('shows the sets once the rail is approached, and nothing for a product in none', async () => {
    mockListBundles.mockResolvedValue([
      bundle({ id: 'a', name: 'Karseell Duo' }),
      bundle({ id: 'b', name: 'Other set', members: [member('p-other')] }),
    ]);

    // Stand in for a browser observer that reports the sentinel as visible.
    const observers: IntersectionObserverCallback[] = [];
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        observers.push(cb);
      }
      observe() {
        const cb = observers[observers.length - 1];
        cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    } as unknown as typeof IntersectionObserver;

    try {
      render(<BundleCrossSell productId={PRODUCT_IN_A_SET} />);
      expect(await screen.findByTestId('bundle-cross-sell')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Karseell Duo' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Other set' })).not.toBeInTheDocument();
      // One read per page load — the same promise the bag uses.
      expect(mockListBundles).toHaveBeenCalledTimes(1);

      resetBundleCatalogCache();
      const { container } = render(<BundleCrossSell productId={PRODUCT_IN_NO_SET} />);
      // Wait for the catalogue to actually arrive before concluding "nothing":
      // asserting on the first frame would pass for the wrong reason.
      await waitFor(() => expect(mockListBundles).toHaveBeenCalledTimes(2));
      expect(container.querySelector('[data-testid="bundle-cross-sell"]')).toBeNull();
      expect(container.textContent).toBe('');
    } finally {
      globalThis.IntersectionObserver = original;
    }
  });
});

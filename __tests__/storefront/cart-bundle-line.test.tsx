import React from 'react';
import { render, screen } from '@testing-library/react';
import CartItemRow from '@/components/storefront/cart/CartItemRow';
import {
  groupBagLines,
  planSetQty,
  toPricingLines,
  UNNAMED_BUNDLE_LABEL,
  type BundleIndex,
} from '@/components/storefront/cart/bag-lines';
import type { CartItemDto } from '@/lib/api/cart';
import type { Bundle } from '@/lib/api/bundles';

/**
 * #56 — a bundle is ONE thing in the bag.
 *
 * The fixtures below are the real response from
 * `POST https://backend.minirueshop.com/v1/cart/bundles` for the Karseell set
 * named in the issue, trimmed only of fields the bag does not read: two member
 * rows at EGP 800 each, sharing a `bundleId` and a `bundleLineKey`, with no
 * `name` and no image on either — which is exactly why the bag used to show
 * two lines reading `Variant #6c5db783-…`.
 *
 * What these pin down is the translation from those rows to what a shopper
 * sees, and the write plan that goes back the other way. Everything the server
 * holds stays a real variant line, so the order still records the components
 * and the dashboard still sees the breakdown.
 */

const BUNDLE_ID = 'c9a9492a-3a45-4efd-8a96-3c01b3b3153b';
const SHAMPOO = '6c5db783-4d47-41b5-8308-2990c54958cf';
const CONDITIONER = '00b96290-26de-474e-b5a4-b6e55a184946';
const SET_IMAGE = 'https://img.minirueshop.com/karseell-set.webp';

function memberRow(
  id: string,
  variantId: string,
  over: Partial<CartItemDto> = {},
): CartItemDto {
  return {
    id,
    variantId,
    qty: 1,
    unitPriceAmount: '800.00',
    unitPriceCurrency: 'EGP',
    lineTotalAmount: '800.00',
    availableQuantity: 10,
    bundleId: BUNDLE_ID,
    bundleLineKey: 'fef0d2cb-f129-4da1-9d46-d7f2e9a24c66',
    ...over,
  };
}

/** One add of the set, as the API returns it. */
function oneSet(): CartItemDto[] {
  return [memberRow('row-a', SHAMPOO), memberRow('row-b', CONDITIONER)];
}

function bundleFixture(over: Partial<Bundle> = {}): Bundle {
  return {
    id: BUNDLE_ID,
    slug: 'karseell-collagen-hair-shampoo-hair-conditioner-set',
    name: 'Karseell Collagen Hair Shampoo+Hair Conditioner Set',
    description: null,
    imageUrl: SET_IMAGE,
    priceMinor: 160_000,
    currency: 'EGP',
    listTotalMinor: 170_000,
    savingMinor: 10_000,
    inStock: true,
    members: [
      {
        productId: 'p1',
        variantId: SHAMPOO,
        productName: 'Karseell Collagen Hair Shampoo',
        productSlug: 'karseell-collagen-hair-shampoo',
        categorySlug: 'haircare',
        brandName: 'Karseell',
        quantity: 1,
        unitMinor: 85_000,
        allocatedMinor: 80_000,
      },
      {
        productId: 'p2',
        variantId: CONDITIONER,
        productName: 'Karseell Deep-Restoring Hair Conditioner',
        productSlug: 'karseell-deep-restoring-hair-conditioner',
        categorySlug: 'haircare',
        brandName: 'Karseell',
        quantity: 1,
        unitMinor: 85_000,
        allocatedMinor: 80_000,
      },
    ],
    ...over,
  };
}

function indexOf(bundle: Bundle): BundleIndex {
  return new Map([[bundle.id, bundle]]);
}

// ── Grouping ────────────────────────────────────────────────────────────────

describe('groupBagLines — a set is one line', () => {
  it('collapses the member rows into a single named, pictured line at the set price', () => {
    const lines = groupBagLines(oneSet(), indexOf(bundleFixture()));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: 'bundle',
      name: 'Karseell Collagen Hair Shampoo+Hair Conditioner Set',
      imageUrl: SET_IMAGE,
      href: '/bundles/karseell-collagen-hair-shampoo-hair-conditioner-set',
      qty: 1,
      // The set price (1,600), never the sum of the parts bought separately
      // (1,700).
      unitPriceAmount: '1600.00',
      lineTotalAmount: '1600.00',
      currency: 'EGP',
    });
    // The components are still there underneath — this is what checkout sends
    // and what the dashboard reads back as the breakdown.
    expect(lines[0].items.map((i) => i.variantId)).toEqual([SHAMPOO, CONDITIONER]);
  });

  it('names the set from the line itself when the API sends it, in preference to the lookup', () => {
    const rows = oneSet().map((r) => ({
      ...r,
      bundleName: 'Renamed by the server',
      bundleImageUrl: 'https://img.minirueshop.com/from-the-api.webp',
    }));

    const [line] = groupBagLines(rows, indexOf(bundleFixture()));

    expect(line.name).toBe('Renamed by the server');
    expect(line.imageUrl).toBe('https://img.minirueshop.com/from-the-api.webp');
  });

  it('falls back to a generic set label — never a UUID — when the set is no longer listed', () => {
    // A set deactivated or expired while it sat in the bag drops out of
    // GET /v1/bundles, so there is nothing to look its name up in.
    const [line] = groupBagLines(oneSet(), new Map());

    expect(line.name).toBe(UNNAMED_BUNDLE_LABEL);
    expect(line.name).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    // Still priced from what the server charged.
    expect(line.lineTotalAmount).toBe('1600.00');
  });

  it('reads two adds of the same set as one line at quantity 2', () => {
    // Verified against the live backend: POST /v1/cart/bundles twice writes a
    // SECOND group with its own bundleLineKey rather than raising a quantity.
    const rows = [
      ...oneSet(),
      memberRow('row-c', SHAMPOO, { bundleLineKey: 'second-add' }),
      memberRow('row-d', CONDITIONER, { bundleLineKey: 'second-add' }),
    ];

    const [line, ...rest] = groupBagLines(rows, indexOf(bundleFixture()));

    expect(rest).toHaveLength(0);
    expect(line.qty).toBe(2);
    expect(line.lineTotalAmount).toBe('3200.00');
    expect(line.unitPriceAmount).toBe('1600.00');
  });

  it('keeps a standalone copy of a member as its own line', () => {
    // The backend deliberately never merges an ordinary add into a set; the
    // bag must not merge them either, or the set's price would change.
    const rows = [
      ...oneSet(),
      {
        id: 'row-solo',
        variantId: SHAMPOO,
        qty: 1,
        unitPriceAmount: '850.00',
        unitPriceCurrency: 'EGP',
        lineTotalAmount: '850.00',
        bundleId: null,
        bundleLineKey: '',
        name: 'Karseell Collagen Hair Shampoo',
      } satisfies CartItemDto,
    ];

    const lines = groupBagLines(rows, indexOf(bundleFixture()));

    expect(lines.map((l) => l.kind)).toEqual(['bundle', 'item']);
    expect(lines[1].unitPriceAmount).toBe('850.00');
  });

  it('caps the stepper on the scarcest member, counted in SETS', () => {
    const rows = [
      memberRow('row-a', SHAMPOO, { availableQuantity: 9 }),
      memberRow('row-b', CONDITIONER, { availableQuantity: 3 }),
    ];

    const [line] = groupBagLines(rows, indexOf(bundleFixture()));

    expect(line.maxQty).toBe(3);
    expect(line.scarce).toBe(true);
  });

  it('caps a set whose member takes two units at five, because a cart row stops at ten', () => {
    const bundle = bundleFixture();
    bundle.members[0].quantity = 2;
    const rows = [
      memberRow('row-a', SHAMPOO, { qty: 2 }),
      memberRow('row-b', CONDITIONER),
    ];

    const [line] = groupBagLines(rows, indexOf(bundle));

    expect(line.qty).toBe(1);
    expect(line.maxQty).toBe(5);
  });
});

// ── Write plan ──────────────────────────────────────────────────────────────

describe('planSetQty — one quantity, applied to every component', () => {
  it('reserves two of every component when the set goes to two', () => {
    const [line] = groupBagLines(oneSet(), indexOf(bundleFixture()));

    expect(planSetQty(line, 2)).toEqual([
      { op: 'patch', itemId: 'row-a', qty: 2 },
      { op: 'patch', itemId: 'row-b', qty: 2 },
    ]);
  });

  it('multiplies through a member that takes two units per set', () => {
    const bundle = bundleFixture();
    bundle.members[0].quantity = 2;
    const rows = [
      memberRow('row-a', SHAMPOO, { qty: 2 }),
      memberRow('row-b', CONDITIONER),
    ];
    const [line] = groupBagLines(rows, indexOf(bundle));

    expect(planSetQty(line, 3)).toEqual([
      { op: 'patch', itemId: 'row-a', qty: 6 },
      { op: 'patch', itemId: 'row-b', qty: 3 },
    ]);
  });

  it('removing the line removes the whole set, not one component', () => {
    const [line] = groupBagLines(oneSet(), indexOf(bundleFixture()));

    expect(planSetQty(line, 0)).toEqual([
      { op: 'delete', itemId: 'row-a' },
      { op: 'delete', itemId: 'row-b' },
    ]);
  });

  it('normalises a bag that already holds two separate adds, with no migration', () => {
    const rows = [
      ...oneSet(),
      memberRow('row-c', SHAMPOO, { bundleLineKey: 'second-add' }),
      memberRow('row-d', CONDITIONER, { bundleLineKey: 'second-add' }),
    ];
    const [line] = groupBagLines(rows, indexOf(bundleFixture()));

    // Down from two sets to one: the first row of each variant absorbs the
    // total and the leftovers from the duplicate add go.
    expect(planSetQty(line, 1)).toEqual([
      { op: 'delete', itemId: 'row-c' },
      { op: 'delete', itemId: 'row-d' },
    ]);
  });

  it('writes nothing when the quantity has not moved', () => {
    const [line] = groupBagLines(oneSet(), indexOf(bundleFixture()));
    expect(planSetQty(line, 1)).toEqual([]);
  });
});

// ── Discount eligibility ────────────────────────────────────────────────────

describe('toPricingLines — a code cannot reach into a set', () => {
  it('carries the bundle markers the server filters on', () => {
    const lines = groupBagLines(oneSet(), indexOf(bundleFixture()));
    const priced = toPricingLines(lines, indexOf(bundleFixture()));

    expect(priced).toHaveLength(2);
    for (const line of priced) {
      // `priceBag()` keeps only `isMinirueOwned && !bundleId`. Without these
      // the members looked like ordinary lines and were priced as eligible,
      // against the bundle page's own "Discount codes do not apply to sets".
      expect(line.bundleId).toBe(BUNDLE_ID);
      expect(line.bundleLineKey).toBe('fef0d2cb-f129-4da1-9d46-d7f2e9a24c66');
      expect(line.bundleListTotalMinor).toBe(170_000);
    }
  });

  it('scales the set list total by how many sets that group holds', () => {
    const rows = [
      memberRow('row-a', SHAMPOO, { qty: 2 }),
      memberRow('row-b', CONDITIONER, { qty: 2 }),
    ];
    const lines = groupBagLines(rows, indexOf(bundleFixture()));

    expect(toPricingLines(lines, indexOf(bundleFixture()))[0].bundleListTotalMinor).toBe(
      340_000,
    );
  });

  it('leaves an ordinary line unmarked, so it stays eligible', () => {
    const rows: CartItemDto[] = [
      {
        id: 'row-solo',
        variantId: SHAMPOO,
        qty: 2,
        unitPriceAmount: '850.00',
        unitPriceCurrency: 'EGP',
        lineTotalAmount: '1700.00',
        name: 'Karseell Collagen Hair Shampoo',
      },
    ];

    expect(toPricingLines(groupBagLines(rows))).toEqual([
      { variantId: SHAMPOO, qty: 2, unitPriceMinor: 85_000 },
    ]);
  });
});

// ── Rendering ───────────────────────────────────────────────────────────────

describe('CartItemRow — a set on screen', () => {
  function renderSet(index: BundleIndex = indexOf(bundleFixture())) {
    const [line] = groupBagLines(oneSet(), index);
    return render(
      <CartItemRow line={line} onUpdateQty={async () => {}} onRemove={async () => {}} />,
    );
  }

  it('shows the set name, its own photo and exactly one stepper', () => {
    renderSet();

    expect(
      screen.getByText('Karseell Collagen Hair Shampoo+Hair Conditioner Set'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Increase quantity' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Decrease quantity' })).toHaveLength(1);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Karseell Collagen Hair Shampoo+Hair Conditioner Set');
    expect(img.getAttribute('src') ?? '').toContain(encodeURIComponent(SET_IMAGE));
  });

  it('offers one remove control, for the set', () => {
    renderSet();

    expect(
      screen.getByRole('button', {
        name: 'Remove Karseell Collagen Hair Shampoo+Hair Conditioner Set from cart',
      }),
    ).toBeInTheDocument();
  });

  it('never puts a variant id on screen, named or not', () => {
    const { container, unmount } = renderSet();
    expect(container.textContent).not.toContain(SHAMPOO);
    expect(container.textContent).not.toContain('Variant #');
    unmount();

    const bare = renderSet(new Map());
    expect(bare.container.textContent).not.toContain(SHAMPOO);
    expect(bare.container.textContent).not.toContain('Variant #');
  });
});

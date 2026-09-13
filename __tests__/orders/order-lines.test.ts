import { groupRowsByBundle, setQtyFromRows } from '@/lib/bundles/group-by-bundle';
import { groupOrderLines, UNNAMED_SET_LABEL } from '@/lib/orders/order-lines';
import type { OrderItemSummary } from '@/lib/checkout/checkout-api';

/**
 * #116 — after checkout a set read as its parts on every order screen.
 *
 * The bag learned to show a set as one line in #56; the order screens never
 * did, because nothing grouped the member rows. These pin the shared grouping
 * both now use, and the order-side translation: a set bought is ONE line with
 * the set's image, name, quantity and price, and its members are only links.
 */

const SET = 'b1000000-0000-4000-8000-000000000001';

function row(id: string, over: Partial<OrderItemSummary> = {}): OrderItemSummary {
  return {
    id,
    variantId: `v-${id}`,
    qty: 1,
    unitPriceAmount: '199.5000',
    lineTotalAmount: '199.5000',
    productSnapshot: { name: `Product ${id}`, brand: 'MiniRue', imageUrl: `https://img/${id}.jpg` },
    bundleId: null,
    bundleLineKey: '',
    bundle: null,
    ...over,
  };
}

const bundle = { id: SET, name: 'Evening Set', slug: 'evening-set', imageUrl: 'https://img/set.jpg', setQty: 1 };

function member(id: string, key: string, over: Partial<OrderItemSummary> = {}) {
  return row(id, {
    bundleId: SET,
    bundleLineKey: key,
    bundle,
    productSnapshot: {
      name: `Member ${id}`,
      brand: 'MiniRue',
      imageUrl: `https://img/${id}.jpg`,
      productSlug: `member-${id}`,
      categorySlug: 'perfume',
    },
    ...over,
  });
}

describe('groupRowsByBundle — the one grouping the bag and the orders share', () => {
  it('keeps a standalone row alone and a set together, where the set first appeared', () => {
    const rows = [
      { id: 'a', bundleId: null },
      { id: 'm1', bundleId: SET },
      { id: 'b', bundleId: undefined },
      { id: 'm2', bundleId: SET },
    ];
    const groups = groupRowsByBundle(rows);
    expect(groups.map((g) => (g.kind === 'bundle' ? `set:${g.rows.map((r) => r.id).join('+')}` : g.row.id))).toEqual([
      'a',
      'set:m1+m2',
      'b',
    ]);
  });

  it('counts sets by what every member agrees on', () => {
    expect(setQtyFromRows([{ variantId: 'x', qty: 2 }, { variantId: 'y', qty: 2 }])).toBe(2);
    expect(setQtyFromRows([{ variantId: 'x', qty: 2 }, { variantId: 'y', qty: 1 }])).toBe(1);
    expect(setQtyFromRows([{ variantId: 'x', qty: 4 }], new Map([['x', 2]]))).toBe(2);
    // A member the set defines but no row holds: incomplete, reads down to 1.
    expect(setQtyFromRows([{ variantId: 'x', qty: 4 }], new Map([['x', 1], ['y', 1]]))).toBe(1);
  });
});

describe('groupOrderLines', () => {
  it('turns a 2-piece set and a product into TWO lines, the set priced as a whole', () => {
    const lines = groupOrderLines([
      member('m1', 'k1', { lineTotalAmount: '199.5000' }),
      row('p1', { lineTotalAmount: '799.0000' }),
      member('m2', 'k1', { lineTotalAmount: '200.0000' }),
    ]);

    expect(lines).toHaveLength(2);
    const [set, product] = lines;
    expect(set).toMatchObject({
      kind: 'bundle',
      name: 'Evening Set',
      imageUrl: 'https://img/set.jpg',
      qty: 1,
      lineTotalAmount: '399.50',
    });
    // Members are links to their product page and nothing else.
    expect(set.members).toEqual([
      { key: 'v-m1', name: 'Member m1', href: '/shop/perfume/member-m1' },
      { key: 'v-m2', name: 'Member m2', href: '/shop/perfume/member-m2' },
    ]);
    expect(product).toMatchObject({
      kind: 'item',
      name: 'Product p1',
      imageUrl: 'https://img/p1.jpg',
      qty: 1,
      lineTotalAmount: '799.0000',
      members: [],
    });
  });

  it('reads two adds of the same set as quantity 2 of one line', () => {
    const lines = groupOrderLines([
      member('m1', 'k1'),
      member('m2', 'k1'),
      member('m3', 'k2', { variantId: 'v-m1' }),
      member('m4', 'k2', { variantId: 'v-m2' }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'bundle', qty: 2, lineTotalAmount: '798.00' });
    // Still one link per product, not per row.
    expect(lines[0].members.map((m) => m.key)).toEqual(['v-m1', 'v-m2']);
  });

  it('uses the frozen set count rather than guessing from member quantities', () => {
    // One set holding two of the same product: the rows alone would say 2.
    const lines = groupOrderLines([
      member('m1', 'k1', { qty: 2, bundle: { ...bundle, setQty: 1 } }),
    ]);
    expect(lines[0].qty).toBe(1);
  });

  it('degrades on an older API with no bundle field: "Set", first member image, quantity from rows', () => {
    const lines = groupOrderLines([
      member('m1', 'k1', { bundle: undefined, qty: 2 }),
      member('m2', 'k1', { bundle: undefined, qty: 2, productSnapshot: { name: 'Member m2' } }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: 'bundle',
      name: UNNAMED_SET_LABEL,
      imageUrl: 'https://img/m1.jpg',
      qty: 2,
    });
    // No slug from the API → no link, never a broken one.
    expect(lines[0].members[1]).toEqual({ key: 'v-m2', name: 'Member m2', href: null });
  });

  it('falls back to a member image when the set has no picture of its own', () => {
    const lines = groupOrderLines([member('m1', 'k1', { bundle: { ...bundle, imageUrl: null } })]);
    expect(lines[0].imageUrl).toBe('https://img/m1.jpg');
  });
});

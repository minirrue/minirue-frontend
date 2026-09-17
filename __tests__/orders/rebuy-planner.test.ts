import { planRebuy } from '@/lib/orders/rebuy';
import type { ApiProduct, ProductVariant } from '@/lib/api/catalog';
import type { Bundle } from '@/lib/api/bundles';
import type { CartItemDto } from '@/lib/api/cart';
import type { OrderItemSummary } from '@/lib/checkout/checkout-api';

function variant(id: string, availableQuantity: number): ProductVariant {
  return {
    id,
    sku: `sku-${id}`,
    priceAmount: '100.00',
    priceCurrency: 'EGP',
    isActive: true,
    availableQuantity,
    inStock: availableQuantity > 0,
  };
}

function product(id: string, variants: ProductVariant[]): ApiProduct {
  return { id, slug: id, name: `Product ${id}`, variants, media: [] };
}

function orderItem(id: string, variantId: string, qty: number): OrderItemSummary {
  return {
    id,
    variantId,
    qty,
    unitPriceAmount: '100.00',
    lineTotalAmount: String(100 * qty),
    productSnapshot: { name: `Ordered ${id}`, brand: 'MiniRue' },
  };
}

function cartItem(variantId: string, qty: number): CartItemDto {
  return {
    id: `cart-${variantId}`,
    variantId,
    qty,
    unitPriceAmount: '100.00',
    unitPriceCurrency: 'EGP',
    lineTotalAmount: String(100 * qty),
  };
}

describe('planRebuy', () => {
  it('plans a complete buy-again from current variant data', () => {
    const plan = planRebuy(
      [orderItem('rose', 'v-rose', 2)],
      [product('rose', [variant('v-rose', 8)])],
      [],
      [],
    );

    expect(plan.issues).toEqual([]);
    expect(plan.actions).toEqual([
      expect.objectContaining({ kind: 'item', name: 'Ordered rose', variantId: 'v-rose', qty: 2 }),
    ]);
  });

  it('clamps against stock and what is already in the bag', () => {
    const plan = planRebuy(
      [orderItem('rose', 'v-rose', 5)],
      [product('rose', [variant('v-rose', 3)])],
      [],
      [cartItem('v-rose', 1)],
    );

    expect(plan.actions).toEqual([
      expect.objectContaining({ kind: 'item', variantId: 'v-rose', qty: 2, requestedQty: 5 }),
    ]);
    expect(plan.issues).toEqual([
      { name: 'Ordered rose', kind: 'quantity-adjusted', requestedQty: 5, addedQty: 2 },
    ]);
  });

  it('reports a no-item result when the ordered variant is no longer sellable', () => {
    const plan = planRebuy(
      [orderItem('rose', 'v-rose', 1)],
      [product('rose', [variant('v-rose', 0)])],
      [],
      [],
    );

    expect(plan.actions).toEqual([]);
    expect(plan.issues).toEqual([
      { name: 'Ordered rose', kind: 'unavailable', requestedQty: 1, addedQty: 0 },
    ]);
  });

  it('preserves a current set and clamps it by its scarcest live member', () => {
    const set = { id: 'set-1', name: 'Evening Set', slug: 'evening-set', imageUrl: null, setQty: 2 };
    const rows: OrderItemSummary[] = [
      { ...orderItem('rose', 'v-rose', 2), bundleId: set.id, bundleLineKey: 'line-1', bundle: set },
      { ...orderItem('musk', 'v-musk', 2), bundleId: set.id, bundleLineKey: 'line-1', bundle: set },
    ];
    const bundle: Bundle = {
      id: set.id,
      slug: set.slug,
      name: set.name,
      description: null,
      imageUrl: null,
      priceMinor: 15000,
      currency: 'EGP',
      listTotalMinor: 20000,
      savingMinor: 5000,
      inStock: true,
      members: [
        { productId: 'rose', variantId: 'v-rose', productName: 'Rose', productSlug: 'rose', brandName: 'MiniRue', quantity: 1, unitMinor: 10000, allocatedMinor: 7500 },
        { productId: 'musk', variantId: 'v-musk', productName: 'Musk', productSlug: 'musk', brandName: 'MiniRue', quantity: 1, unitMinor: 10000, allocatedMinor: 7500 },
      ],
    };

    const plan = planRebuy(
      rows,
      [product('rose', [variant('v-rose', 6)]), product('musk', [variant('v-musk', 1)])],
      [bundle],
      [],
    );

    expect(plan.actions).toEqual([
      { kind: 'bundle', name: 'Evening Set', slug: 'evening-set', qty: 1, requestedQty: 2 },
    ]);
    expect(plan.issues).toEqual([
      { name: 'Evening Set', kind: 'quantity-adjusted', requestedQty: 2, addedQty: 1 },
    ]);
  });
});

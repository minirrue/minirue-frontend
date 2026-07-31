import { cheapestActiveVariant, lowestPrice, productInStock } from '@/lib/api/catalog';
import {
  ALL_SOLD_OUT_FIXTURE,
  IN_STOCK_VARIANT,
  PRODUCT_FIXTURE,
  SOLD_OUT_VARIANT,
} from './fixtures/product';

/**
 * productInStock() is the shared "is this product buyable" rule used by both
 * ProductSchema and SearchResultsSchema. It must say IN stock whenever any
 * active variant is, and OUT of stock only when none are — never derived
 * from a single variant, and never from a stale product-level flag.
 */
describe('productInStock', () => {
  it('is true when at least one active variant is in stock', () => {
    // PRODUCT_FIXTURE: 50ml in stock, 100ml sold out.
    expect(productInStock(PRODUCT_FIXTURE)).toBe(true);
  });

  it('is false when every variant is sold out', () => {
    expect(productInStock(ALL_SOLD_OUT_FIXTURE)).toBe(false);
  });

  it('ignores inactive variants entirely, even if they claim to be in stock', () => {
    const product = {
      variants: [{ ...IN_STOCK_VARIANT, isActive: false }],
    };
    expect(productInStock(product)).toBe(false);
  });

  it('is false with no variants at all', () => {
    expect(productInStock({ variants: [] })).toBe(false);
    expect(productInStock({})).toBe(false);
  });
});

describe('cheapestActiveVariant / lowestPrice', () => {
  it('picks the lower-priced active variant, not just the first one', () => {
    // IN_STOCK_VARIANT (50ml) is 400, SOLD_OUT_VARIANT (100ml) is 700 — but
    // SOLD_OUT_VARIANT is inactive-agnostic here (isActive true, only stock
    // differs), so this also proves price wins over list order.
    const variant = cheapestActiveVariant(PRODUCT_FIXTURE);
    expect(variant?.sku).toBe(IN_STOCK_VARIANT.sku);
    expect(lowestPrice(PRODUCT_FIXTURE)).toEqual({ amount: '400', currency: 'EGP' });
  });

  it('skips inactive variants when choosing the cheapest', () => {
    const product = {
      ...PRODUCT_FIXTURE,
      variants: [
        { ...IN_STOCK_VARIANT, priceAmount: '100', isActive: false },
        SOLD_OUT_VARIANT,
      ],
    };
    expect(cheapestActiveVariant(product)?.sku).toBe(SOLD_OUT_VARIANT.sku);
  });

  it('is null/none when there are no active variants', () => {
    const product = { ...PRODUCT_FIXTURE, variants: [] };
    expect(cheapestActiveVariant(product)).toBeNull();
    expect(lowestPrice(product)).toBeNull();
  });
});

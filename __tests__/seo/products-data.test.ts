/**
 * `app/products/products-data.ts` backs the brand-filtered `/products`
 * metadata (Task 10) the same way `app/search/search-data.ts` backs
 * `/search` — pure derivation functions tested directly against fixtures,
 * plus the fetch wrapper itself exercised against a mocked catalog client so
 * the outage branch (try/catch → `ok: false`) is proven, not assumed.
 */

const listProducts = jest.fn();
jest.mock('@/lib/api/catalog', () => {
  const actual = jest.requireActual('@/lib/api/catalog');
  return {
    ...actual,
    catalog: { listProducts: (...args: unknown[]) => listProducts(...args) },
  };
});

jest.mock('@/lib/api/storefront', () => {
  const actual = jest.requireActual('@/lib/api/storefront');
  return {
    ...actual,
    fetchStorefrontChrome: jest.fn().mockResolvedValue(actual.FALLBACK_CHROME),
  };
});

import {
  getProductListing,
  isIndexableBrandListing,
  brandListingName,
  categoryListingName,
  getShopName,
} from '@/app/products/products-data';
import type { BrandListingOutcome } from '@/app/products/products-data';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

beforeEach(() => {
  listProducts.mockReset();
});

describe('getProductListing', () => {
  it('returns ok: true with the resolved products on a successful fetch', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });
    const outcome = await getProductListing('', 'brand-billie');
    expect(outcome).toEqual({
      ok: true,
      products: [PRODUCT_FIXTURE],
      total: 1,
      hasMore: false,
      cursor: null,
    });
  });

  it('passes brandId and brand through to catalog.listProducts when present', async () => {
    listProducts.mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } });
    await getProductListing('Chanel', 'brand-billie');
    expect(listProducts).toHaveBeenCalledWith({ brand: 'Chanel', brandId: 'brand-billie', limit: 24 });
  });

  it('passes categoryId through to catalog.listProducts when present', async () => {
    listProducts.mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } });
    await getProductListing('', '', 'cat-perfume');
    expect(listProducts).toHaveBeenCalledWith({ categoryId: 'cat-perfume', limit: 24 });
  });

  it('omits empty filter strings from the catalog call rather than sending brand: ""', async () => {
    listProducts.mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } });
    await getProductListing('', '');
    expect(listProducts).toHaveBeenCalledWith({ limit: 24 });
  });

  // The dangerous case: a backend outage must never be reported as "this
  // brand has zero products" — it has its own ok: false shape so the caller
  // can tell the two apart.
  it('returns ok: false on a fetch failure, distinct from a real empty result', async () => {
    listProducts.mockRejectedValue(new Error('ECONNREFUSED'));
    const outcome = await getProductListing('', 'brand-unreachable');
    expect(outcome).toEqual({ ok: false, products: [], total: 0, hasMore: false, cursor: null });
  });
});

describe('isIndexableBrandListing', () => {
  const ok = (total: number): BrandListingOutcome => ({
    ok: true,
    products: total > 0 ? [PRODUCT_FIXTURE] : [],
    total,
    hasMore: false,
    cursor: null,
  });
  const failed: BrandListingOutcome = { ok: false, products: [], total: 0, hasMore: false, cursor: null };

  it('is indexable: a real filter that resolved to results', () => {
    expect(isIndexableBrandListing(true, ok(3))).toBe(true);
  });

  it('is not indexable: a real filter with zero results', () => {
    expect(isIndexableBrandListing(true, ok(0))).toBe(false);
  });

  it('is not indexable: no filter was applied at all', () => {
    expect(isIndexableBrandListing(false, ok(3))).toBe(false);
  });

  // The rule the brief calls out as most easily lost: an outage must yield
  // index: false even though it superficially looks like "zero results".
  it('is not indexable: the fetch failed (API outage)', () => {
    expect(isIndexableBrandListing(true, failed)).toBe(false);
  });
});

describe('brandListingName', () => {
  it('reads the brand name from the first resolved product', () => {
    const outcome: BrandListingOutcome = {
      ok: true,
      products: [PRODUCT_FIXTURE],
      total: 1,
      hasMore: false,
      cursor: null,
    };
    expect(brandListingName(outcome)).toBe(PRODUCT_FIXTURE.brandName);
  });

  it('is null when there are no products — never falls back to a fabricated name', () => {
    const empty: BrandListingOutcome = { ok: true, products: [], total: 0, hasMore: false, cursor: null };
    expect(brandListingName(empty)).toBeNull();
  });

  it('is null on a failed fetch, same as any other empty result', () => {
    const failed: BrandListingOutcome = { ok: false, products: [], total: 0, hasMore: false, cursor: null };
    expect(brandListingName(failed)).toBeNull();
  });
});

describe('categoryListingName', () => {
  it('reads the category name from the first resolved product', () => {
    const outcome: BrandListingOutcome = {
      ok: true,
      products: [PRODUCT_FIXTURE],
      total: 1,
      hasMore: false,
      cursor: null,
    };
    expect(categoryListingName(outcome)).toBe(PRODUCT_FIXTURE.categoryName);
  });

  it('is null when there are no products — never falls back to a fabricated name', () => {
    const empty: BrandListingOutcome = { ok: true, products: [], total: 0, hasMore: false, cursor: null };
    expect(categoryListingName(empty)).toBeNull();
  });

  it('is null on a failed fetch, same as any other empty result', () => {
    const failed: BrandListingOutcome = { ok: false, products: [], total: 0, hasMore: false, cursor: null };
    expect(categoryListingName(failed)).toBeNull();
  });
});

describe('getShopName', () => {
  it('reads shopName from the resolved chrome', async () => {
    expect(await getShopName()).toBe('MiniRue');
  });
});

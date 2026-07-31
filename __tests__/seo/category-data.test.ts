/**
 * `app/categories/[slug]/category-data.ts` adds the richer, count/brand-based
 * description (Task 10). Pure derivation functions are tested directly
 * against fixtures; the fetch wrappers are exercised against a mocked
 * catalog client so the outage branches (try/catch → `ok: false` / `null`)
 * are proven, not assumed.
 */

const listProducts = jest.fn();
const listCategories = jest.fn();
jest.mock('@/lib/api/catalog', () => {
  const actual = jest.requireActual('@/lib/api/catalog');
  return {
    ...actual,
    catalog: {
      listProducts: (...args: unknown[]) => listProducts(...args),
      listCategories: (...args: unknown[]) => listCategories(...args),
    },
  };
});

import {
  getCategoryListing,
  resolveCategoryPath,
  buildCategoryDescription,
  representativeBrandNames,
} from '@/app/categories/[slug]/category-data';
import type { CategoryListingOutcome } from '@/app/categories/[slug]/category-data';
import type { Category } from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

const RINGS: Category = { id: 'cat-rings', slug: 'rings', name: 'Rings', parentId: null };

beforeEach(() => {
  listProducts.mockReset();
  listCategories.mockReset();
});

describe('resolveCategoryPath', () => {
  it('resolves a slug to its ancestry', async () => {
    listCategories.mockResolvedValue([RINGS]);
    const path = await resolveCategoryPath('rings');
    expect(path).toEqual([RINGS]);
  });

  it('is null for an unknown slug', async () => {
    listCategories.mockResolvedValue([RINGS]);
    expect(await resolveCategoryPath('does-not-exist')).toBeNull();
  });

  // The bug this branch fixes: an outage must NOT collapse into the same
  // `null` a genuinely unknown slug returns — that shape is what let
  // app/categories/[slug]/page.tsx turn a transient backend blip into
  // notFound(), 404ing an indexed category URL during an outage. Rethrowing
  // instead lets Next serve a 500, which is recoverable and never de-indexes
  // the URL the way a published 404 does.
  it('rethrows on a fetch failure, rather than returning null like an unknown slug', async () => {
    listCategories.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(resolveCategoryPath('rings')).rejects.toThrow('ECONNREFUSED');
  });
});

describe('getCategoryListing', () => {
  it('returns ok: true with the resolved products on a successful fetch', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });
    const outcome = await getCategoryListing('cat-rings');
    expect(outcome).toEqual({ ok: true, products: [PRODUCT_FIXTURE], total: 1, hasMore: false, cursor: null });
    expect(listProducts).toHaveBeenCalledWith({ categoryId: 'cat-rings', limit: 24 });
  });

  // The dangerous case: an outage must never be described as "this category
  // is empty" — it gets its own ok: false shape.
  it('returns ok: false on a fetch failure, distinct from a real empty category', async () => {
    listProducts.mockRejectedValue(new Error('ECONNREFUSED'));
    const outcome = await getCategoryListing('cat-unreachable');
    expect(outcome).toEqual({ ok: false, products: [], total: 0, hasMore: false, cursor: null });
  });
});

describe('representativeBrandNames', () => {
  it('dedupes brand names, preserving first-seen order, capped at max', () => {
    const other = { ...PRODUCT_FIXTURE, id: 'p2', brandName: 'Other House', brand: 'Other House' };
    const third = { ...PRODUCT_FIXTURE, id: 'p3', brandName: 'Third House', brand: 'Third House' };
    const fourth = { ...PRODUCT_FIXTURE, id: 'p4', brandName: 'Fourth House', brand: 'Fourth House' };
    const names = representativeBrandNames([PRODUCT_FIXTURE, other, PRODUCT_FIXTURE, third, fourth], 3);
    expect(names).toEqual([PRODUCT_FIXTURE.brandName, 'Other House', 'Third House']);
  });

  it('is empty for products with no brand', () => {
    const unbranded = { ...PRODUCT_FIXTURE, brandName: null, brand: null };
    expect(representativeBrandNames([unbranded])).toEqual([]);
  });
});

describe('buildCategoryDescription', () => {
  it('uses the real count and brand names when the fetch succeeded with results', () => {
    const outcome: CategoryListingOutcome = {
      ok: true,
      products: [PRODUCT_FIXTURE],
      total: 12,
      hasMore: true,
      cursor: 'c1',
    };
    expect(buildCategoryDescription('Rings', outcome)).toBe(
      `12 products in Rings from ${PRODUCT_FIXTURE.brandName} at MiniRue. Original quality perfumes and cosmetics, with free worldwide shipping.`,
    );
  });

  it('singularises "product" for a count of exactly one', () => {
    const outcome: CategoryListingOutcome = {
      ok: true,
      products: [PRODUCT_FIXTURE],
      total: 1,
      hasMore: false,
      cursor: null,
    };
    expect(buildCategoryDescription('Rings', outcome)).toContain('1 product in Rings');
  });

  it('falls back to the plain sentence for a genuinely empty category — never fabricates a count', () => {
    const empty: CategoryListingOutcome = { ok: true, products: [], total: 0, hasMore: false, cursor: null };
    expect(buildCategoryDescription('Rings', empty)).toBe('Shop Rings at MiniRue.');
  });

  // The rule most easily lost: an outage must not be described as "0
  // products", which would misreport a transient blip as an empty category.
  it('falls back to the plain sentence on a fetch failure, not a fabricated "0 products"', () => {
    const failed: CategoryListingOutcome = { ok: false, products: [], total: 0, hasMore: false, cursor: null };
    const description = buildCategoryDescription('Rings', failed);
    expect(description).toBe('Shop Rings at MiniRue.');
    expect(description).not.toContain('0');
  });
});

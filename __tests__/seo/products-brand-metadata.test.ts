/**
 * Route-level check for `app/products/page.tsx`'s `generateMetadata` — the
 * full indexability truth table for a brand-filtered `/products` listing
 * (Task 10), exercised against a mocked catalog client rather than the
 * derivation functions in isolation, so a wiring mistake between
 * `products-data.ts` and the page itself would show up here too.
 */

const listProducts = jest.fn();
jest.mock('@/lib/api/catalog', () => {
  const actual = jest.requireActual('@/lib/api/catalog');
  return {
    ...actual,
    catalog: { listProducts: (...args: unknown[]) => listProducts(...args) },
  };
});

import { generateMetadata } from '@/app/products/page';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

function searchParams(params: Record<string, string>) {
  return { searchParams: Promise.resolve(params) };
}

beforeEach(() => {
  listProducts.mockReset();
});

describe('ProductsPage generateMetadata — brand filter', () => {
  it('no filter: stays the static, indexable /products metadata with no API call', async () => {
    const meta = await generateMetadata(searchParams({}));
    expect(meta.alternates).toEqual({ canonical: '/products' });
    expect(meta.robots).toBeUndefined(); // defaults to indexable
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('valid brandId with results: indexable, brand-named title/description, brandId canonical', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 4, hasMore: false, cursor: null },
    });
    const meta = await generateMetadata(searchParams({ brandId: 'brand-billie' }));
    expect(meta.title).toBe(`${PRODUCT_FIXTURE.brandName} — MiniRue`);
    expect(meta.description).toContain('4 products');
    expect(meta.description).toContain(PRODUCT_FIXTURE.brandName as string);
    expect(meta.alternates).toEqual({ canonical: '/products?brandId=brand-billie' });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it('valid brand with zero results: noindex, generic fallback copy, self-referencing canonical', async () => {
    listProducts.mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } });
    const meta = await generateMetadata(searchParams({ brand: 'Nonexistent House' }));
    expect(meta.title).toBe('All Products');
    expect(meta.alternates).toEqual({ canonical: '/products?brand=Nonexistent%20House' });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('unknown brandId: noindex, generic fallback copy — never fabricates a name from the id', async () => {
    listProducts.mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } });
    const meta = await generateMetadata(searchParams({ brandId: 'brand-does-not-exist' }));
    expect(meta.title).toBe('All Products');
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  // The rule most easily lost: an API outage must yield noindex, not an
  // indexable empty page.
  it('fetch failure (API outage): noindex, generic fallback copy, not an indexable empty page', async () => {
    listProducts.mockRejectedValue(new Error('ECONNREFUSED'));
    const meta = await generateMetadata(searchParams({ brandId: 'brand-billie' }));
    expect(meta.title).toBe('All Products');
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('shares one fetch between a single generateMetadata call and does not double-call the API', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });
    await generateMetadata(searchParams({ brandId: 'brand-billie' }));
    expect(listProducts).toHaveBeenCalledTimes(1);
  });
});

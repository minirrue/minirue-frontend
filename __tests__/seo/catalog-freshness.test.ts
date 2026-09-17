/**
 * @jest-environment node
 */
import type { ApiProduct, Category, PaginatedProducts } from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

/**
 * #152 — a product published in the dashboard must reach /llms.txt,
 * /llms-full.txt and /sitemap.xml within 5 minutes, with no code change and
 * no deploy. Two halves: every output is built from whatever the catalog
 * returns (nothing hardcoded), and every cache in front of it is 300s or less.
 */
const FRESHNESS_WINDOW_SECONDS = 300;

const listProducts = jest.fn();
const listCategories = jest.fn();

jest.mock('@/lib/api/catalog', () => ({
  ...jest.requireActual('@/lib/api/catalog'),
  catalog: {
    listProducts: (...args: unknown[]) => listProducts(...args),
    listCategories: (...args: unknown[]) => listCategories(...args),
    search: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } }),
  },
}));
jest.mock('@/lib/api/storefront', () => ({
  fetchSpaces: jest.fn().mockResolvedValue([]),
  fetchSpace: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/api/bundles', () => ({
  listBundles: jest.fn().mockResolvedValue([]),
}));

import sitemap from '@/app/sitemap';
import { GET as llmsTxt } from '@/app/llms.txt/route';
import { GET as llmsFullTxt } from '@/app/llms-full.txt/route';

const variant = PRODUCT_FIXTURE.variants[0];
const product = (slug: string, name: string): ApiProduct => ({
  ...PRODUCT_FIXTURE,
  slug,
  name,
  categoryName: 'Haircare',
  categorySlug: 'haircare',
  description: `<p>${name} description.</p>`,
  variants: [{ ...variant, id: `${slug}-v`, isActive: true, inStock: true, priceAmount: '500.0000', priceCurrency: 'EGP' }],
});

const CATEGORIES: Category[] = [{ id: 'c1', slug: 'haircare', name: 'Haircare', parentId: null }];

function serveCatalog(products: ApiProduct[]) {
  const page: PaginatedProducts = { data: products, meta: { hasMore: false, cursor: null } } as unknown as PaginatedProducts;
  listProducts.mockResolvedValue(page);
  listCategories.mockResolvedValue(CATEGORIES);
}

async function outputs() {
  const [txt, full, map] = await Promise.all([llmsTxt(), llmsFullTxt(), sitemap()]);
  return { txt: await txt.text(), full: await full.text(), urls: map.map((e) => e.url), headers: txt.headers };
}

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(() => {
  listProducts.mockReset();
  listCategories.mockReset();
});

describe('catalog freshness of llms.txt, llms-full.txt and the sitemap (#152)', () => {
  it('a product added to the catalog appears in all three outputs with no code change', async () => {
    serveCatalog([product('old-shampoo', 'Old Shampoo')]);
    const before = await outputs();
    expect(before.txt).not.toContain('Brand New Serum');
    expect(before.full).not.toContain('Brand New Serum');
    expect(before.urls.some((u) => u.endsWith('/shop/haircare/brand-new-serum'))).toBe(false);

    serveCatalog([product('old-shampoo', 'Old Shampoo'), product('brand-new-serum', 'Brand New Serum')]);
    const after = await outputs();
    expect(after.txt).toContain('[Brand New Serum](');
    expect(after.full).toContain('Brand New Serum description.');
    expect(after.urls.some((u) => u.endsWith('/shop/haircare/brand-new-serum'))).toBe(true);
  });

  it('includes a newly published product even when it is on a later catalog page', async () => {
    const oldProduct = product('old-shampoo', 'Old Shampoo');
    const newProduct = product('brand-new-serum', 'Brand New Serum');
    listProducts.mockImplementation(({ cursor }: { cursor?: string }) => Promise.resolve(
      cursor === 'page-2'
        ? { data: [newProduct], meta: { hasMore: false, cursor: null } }
        : { data: [oldProduct], meta: { hasMore: true, cursor: 'page-2' } },
    ));
    listCategories.mockResolvedValue(CATEGORIES);

    const result = await outputs();
    expect(result.txt).toContain('[Brand New Serum](');
    expect(result.full).toContain('Brand New Serum description.');
    expect(result.urls.some((url) => url.endsWith('/shop/haircare/brand-new-serum'))).toBe(true);
  });

  it('keeps the stacked cache layers (data cache + CDN + stale serve) within 5 minutes', async () => {
    serveCatalog([product('old-shampoo', 'Old Shampoo')]);
    const { headers } = await outputs();

    const cacheControl = headers.get('Cache-Control') ?? '';
    const sMaxAge = Number(/s-maxage=(\d+)/.exec(cacheControl)?.[1]);
    const swr = Number(/stale-while-revalidate=(\d+)/.exec(cacheControl)?.[1] ?? 0);
    expect(sMaxAge).toBeGreaterThan(0);

    const windows = [...listProducts.mock.calls, ...listCategories.mock.calls].map(
      ([opts]) => (opts as { revalidate?: number } | undefined)?.revalidate ?? 0,
    );
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) expect(w).toBeGreaterThan(0);
    const dataCache = Math.max(...windows);

    expect(dataCache + sMaxAge + swr).toBeLessThanOrEqual(FRESHNESS_WINDOW_SECONDS);
  });

  it('renders the sitemap per request, so it is never frozen at build time', async () => {
    const mod = await import('@/app/sitemap');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});

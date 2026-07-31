import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SITE_URL } from '@/lib/seo/config';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

/**
 * Re-review-flagged Critical regression from the finding-1 fix: the page BODY
 * of app/products/page.tsx computed `brandName = brandListingName(outcome)`
 * unconditionally, unlike generateMetadata's own
 * `if (!hasFilter) return DEFAULT_METADATA` guard just above it.
 * brandListingName() only reads outcome.products[0]'s brand — it has no idea
 * whether a brand filter was actually requested — so on the plain, unfiltered
 * /products route (where getProductListing('', '') fetches the whole
 * catalogue) `brandName` resolved to whichever product happened to sort
 * first, and the shop's main page rendered THAT brand's name as its own <h1>
 * and CollectionPage name. This never showed up against the products-data
 * unit tests or generateMetadata alone (__tests__/storefront/shop-not-hardcoded.test.tsx
 * only covers generateMetadata) or locally with no backend reachable (an
 * empty product list masks the bug entirely — brandListingName returns null
 * either way), which is exactly why it needs a NON-empty product list here to
 * actually exercise the bug.
 *
 * The full page also renders HeaderWrapper/FooterWithSettings/AnnouncementBar,
 * which need the app router/query-client/cart wiring that isn't the thing
 * under test — same constraint __tests__/storefront/shop-not-hardcoded.test.tsx
 * and __tests__/seo/space-page-json-ld.test.tsx already work around, stubbed
 * here the same way.
 */

jest.mock('next/server', () => ({
  connection: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/products/HeaderWrapper', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/layout/FooterWithSettings', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/layout/AnnouncementBar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/products/ProductListingClient', () => ({
  __esModule: true,
  default: () => null,
}));

const listProducts = jest.fn();
jest.mock('@/lib/api/catalog', () => {
  const actual = jest.requireActual('@/lib/api/catalog');
  return {
    ...actual,
    catalog: { listProducts: (...args: unknown[]) => listProducts(...args) },
  };
});

import ProductsPage from '@/app/products/page';

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function jsonLdNodes(container: HTMLElement): unknown[] {
  return Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
    (el) => JSON.parse(el.innerHTML),
  );
}

describe('/products page body — brandName must be gated on hasFilter (Critical regression)', () => {
  beforeEach(() => {
    listProducts.mockReset();
  });

  it('unfiltered /products with a non-empty catalogue: <h1> and CollectionSchema name stay "All Products"', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });

    const el = await ProductsPage({ searchParams: Promise.resolve({}) });
    const { container } = render(el);

    // The regression: without the hasFilter gate, this would render
    // PRODUCT_FIXTURE.brandName ("Billie Eillish") instead.
    expect(screen.getByRole('heading', { name: 'All Products' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: PRODUCT_FIXTURE.brandName as string })).not.toBeInTheDocument();

    const collection = jsonLdNodes(container).find(
      (n) => (n as { '@type'?: string })['@type'] === 'CollectionPage',
    ) as { name: string; url: string } | undefined;
    expect(collection?.name).toBe('All Products');
    expect(collection?.url).toBe(`${SITE_URL}/products`);
  });

  it('/products?brandId=X with a non-empty result: <h1> and CollectionSchema name carry the brand name', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });

    const el = await ProductsPage({ searchParams: Promise.resolve({ brandId: 'brand-billie' }) });
    const { container } = render(el);

    expect(
      screen.getByRole('heading', { name: PRODUCT_FIXTURE.brandName as string }),
    ).toBeInTheDocument();

    const collection = jsonLdNodes(container).find(
      (n) => (n as { '@type'?: string })['@type'] === 'CollectionPage',
    ) as { name: string; url: string } | undefined;
    expect(collection?.name).toBe(PRODUCT_FIXTURE.brandName);
    expect(collection?.url).toBe(`${SITE_URL}/products?brandId=brand-billie`);
  });
});

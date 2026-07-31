import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SITE_URL } from '@/lib/seo/config';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

/**
 * The owner asked for this page directly ("ensure this page is controllable
 * from storefront ... no hardcoded", then "the breadcrumbs also is not
 * dynamic"). The audit found `app/products/page.tsx` always rendering the
 * visible "Home / Shop" trail regardless of a brand/category filter, and the
 * BreadcrumbList JSON-LD hardcoding the literal 'All Products' even on a
 * filtered page whose <h1> and canonical correctly named the real context.
 *
 * This suite is the contract: for the unfiltered page, a brand-filtered page,
 * and a (newly-supported) category-filtered page, the VISIBLE breadcrumb and
 * the JSON-LD BreadcrumbList must name the exact same trail — a mismatch
 * between the two is treated as its own SEO defect, not just a cosmetic one.
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

function jsonLdNodes(container: HTMLElement): Record<string, unknown>[] {
  return Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
    (el) => JSON.parse(el.innerHTML),
  );
}

function breadcrumbListNames(container: HTMLElement): string[] {
  const breadcrumbList = jsonLdNodes(container).find(
    (n) => n['@type'] === 'BreadcrumbList',
  ) as { itemListElement: Array<{ name: string }> } | undefined;
  return breadcrumbList?.itemListElement.map((item) => item.name) ?? [];
}

function visibleBreadcrumbNames(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
  return Array.from(nav.querySelectorAll('li')).map((li) => li.textContent ?? '');
}

beforeEach(() => {
  listProducts.mockReset();
});

describe('/products breadcrumb — visible trail and JSON-LD agree (Task: no hardcoded breadcrumbs)', () => {
  it('unfiltered /products: both trails stay "Home / Shop", never naming a product that happens to sort first', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });

    const el = await ProductsPage({ searchParams: Promise.resolve({}) });
    const { container } = render(el);

    expect(visibleBreadcrumbNames()).toEqual(['Home', 'Shop']);
    expect(breadcrumbListNames(container)).toEqual(['Home', 'Shop']);
  });

  it('brand-filtered /products?brandId=X: both trails end in the resolved brand name', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });

    const el = await ProductsPage({ searchParams: Promise.resolve({ brandId: 'brand-billie' }) });
    const { container } = render(el);

    const expected = ['Home', 'Shop', PRODUCT_FIXTURE.brandName as string];
    expect(visibleBreadcrumbNames()).toEqual(expected);
    expect(breadcrumbListNames(container)).toEqual(expected);

    // "Shop" stopped being the terminal crumb, so it must now be a real link
    // back to the unfiltered listing rather than plain text.
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/products');

    const breadcrumbList = jsonLdNodes(container).find(
      (n) => n['@type'] === 'BreadcrumbList',
    ) as { itemListElement: Array<{ name: string; item: string }> };
    expect(breadcrumbList.itemListElement.at(-1)?.item).toBe(
      `${SITE_URL}/products?brandId=brand-billie`,
    );
  });

  it('category-filtered /products?categoryId=X: both trails end in the resolved category name', async () => {
    listProducts.mockResolvedValue({
      data: [PRODUCT_FIXTURE],
      meta: { total: 1, hasMore: false, cursor: null },
    });

    const el = await ProductsPage({ searchParams: Promise.resolve({ categoryId: 'cat-perfume' }) });
    const { container } = render(el);

    const expected = ['Home', 'Shop', PRODUCT_FIXTURE.categoryName as string];
    expect(visibleBreadcrumbNames()).toEqual(expected);
    expect(breadcrumbListNames(container)).toEqual(expected);
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/products');

    const breadcrumbList = jsonLdNodes(container).find(
      (n) => n['@type'] === 'BreadcrumbList',
    ) as { itemListElement: Array<{ name: string; item: string }> };
    expect(breadcrumbList.itemListElement.at(-1)?.item).toBe(
      `${SITE_URL}/products?categoryId=cat-perfume`,
    );
  });

  it('a filter that resolves to nothing (zero results) falls back to the same "Home / Shop" trail on both sides', async () => {
    listProducts.mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } });

    const el = await ProductsPage({ searchParams: Promise.resolve({ brandId: 'brand-does-not-exist' }) });
    const { container } = render(el);

    expect(visibleBreadcrumbNames()).toEqual(['Home', 'Shop']);
    expect(breadcrumbListNames(container)).toEqual(['Home', 'Shop']);
  });
});

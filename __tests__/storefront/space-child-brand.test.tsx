import React from 'react';
import { render, screen } from '@testing-library/react';
import type { StorefrontSpace, StorefrontSpaceBrand, StorefrontSpaceCategory } from '@/lib/api/storefront';
import { SITE_URL } from '@/lib/seo/config';

/**
 * Task 7 gap-close — `/helia/chanel` (a brand slug inside a space) used to
 * fall straight through to `notFound()`: `app/[slug]/[child]/page.tsx` only
 * ever branched on `resolved.kind === 'category' | 'product'`, so a brand
 * resolution from the backend had nowhere to go. `SpaceView`'s brand tiles
 * now link here, so this route needed a real `kind === 'brand'` branch.
 *
 * `FooterWithSettings` is an async Client Component this test harness can't
 * mount (a pre-existing constraint, not introduced here — see
 * shop-not-hardcoded.test.tsx) and `HeaderWrapper` needs the app router/query
 * client wiring that isn't the thing under test — both are stubbed so the
 * page's own branching logic is what's actually exercised.
 */

jest.mock('next/server', () => ({
  connection: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/components/layout/FooterWithSettings', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/products/HeaderWrapper', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/api/settings', () => ({
  apiGetPublicSettings: jest.fn().mockRejectedValue(new Error('no settings in test')),
}));

const fetchSpaceChild = jest.fn();
jest.mock('@/lib/api/storefront', () => {
  const actual = jest.requireActual('@/lib/api/storefront');
  return {
    ...actual,
    fetchSpaceChild: (...args: unknown[]) => fetchSpaceChild(...args),
  };
});

const listProducts = jest.fn();
jest.mock('@/lib/api/catalog', () => ({
  catalog: { listProducts: (...args: unknown[]) => listProducts(...args) },
}));

import SpaceChildPage, { generateMetadata } from '@/app/[slug]/[child]/page';

const SPACE: StorefrontSpace = {
  id: 'space-1',
  slug: 'helia',
  name: 'Helia',
  kind: 'PARTNER',
  description: null,
  logoUrl: null,
};

const BRAND: StorefrontSpaceBrand = {
  id: 'brand-1',
  slug: 'chanel',
  name: 'Chanel',
  description: null,
  imageUrl: null,
  isGeneric: false,
};

const CATEGORY: StorefrontSpaceCategory = {
  id: 'cat-1',
  slug: 'jewellery',
  name: 'Jewellery',
  sortOrder: 0,
  imageUrl: null,
};

describe('SpaceChildPage — brand branch (Task 7 gap-close)', () => {
  beforeEach(() => {
    fetchSpaceChild.mockReset();
    listProducts.mockReset().mockResolvedValue({
      data: [],
      meta: { cursor: null, total: 0, hasMore: false },
    });
  });

  it('renders the brand\'s products inside the space rather than 404ing', async () => {
    fetchSpaceChild.mockResolvedValue({ kind: 'brand', space: SPACE, brand: BRAND });

    const el = await SpaceChildPage({
      params: Promise.resolve({ slug: 'helia', child: 'chanel' }),
    });
    render(el);

    expect(screen.getByRole('heading', { name: 'Chanel' })).toBeInTheDocument();
    expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({ brandId: 'brand-1' }));
  });

  it('breadcrumbs read Home / Helia / Chanel for a brand child', async () => {
    fetchSpaceChild.mockResolvedValue({ kind: 'brand', space: SPACE, brand: BRAND });

    const el = await SpaceChildPage({
      params: Promise.resolve({ slug: 'helia', child: 'chanel' }),
    });
    render(el);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Helia' })).toHaveAttribute('href', '/helia');
    // The final crumb ("Chanel") is the current page — not a link — and also
    // the h1, so this asserts it's present at least once rather than picking
    // one role.
    expect(screen.getAllByText('Chanel').length).toBeGreaterThan(0);
  });

  it('still resolves a category child exactly as before (no regression)', async () => {
    fetchSpaceChild.mockResolvedValue({ kind: 'category', space: SPACE, category: CATEGORY });

    const el = await SpaceChildPage({
      params: Promise.resolve({ slug: 'helia', child: 'jewellery' }),
    });
    render(el);

    expect(screen.getByRole('heading', { name: 'Jewellery' })).toBeInTheDocument();
    expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-1' }));
  });

  it('emits a BreadcrumbList JSON-LD node reading Home / Helia / Chanel (Task 9)', async () => {
    fetchSpaceChild.mockResolvedValue({ kind: 'brand', space: SPACE, brand: BRAND });

    const el = await SpaceChildPage({
      params: Promise.resolve({ slug: 'helia', child: 'chanel' }),
    });
    const { container } = render(el);

    const scripts = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]'),
    ).map((s) => JSON.parse(s.innerHTML));
    const breadcrumb = scripts.find((s) => s['@type'] === 'BreadcrumbList') as {
      itemListElement: Array<{ name: string; item: string }>;
    };
    expect(breadcrumb).toBeDefined();
    expect(breadcrumb.itemListElement.map((i) => i.name)).toEqual(['Home', 'Helia', 'Chanel']);
    expect(breadcrumb.itemListElement[1].item).toBe(`${SITE_URL}/helia`);
    expect(breadcrumb.itemListElement[2].item).toBe(`${SITE_URL}/helia/chanel`);
  });

  it('metadata names the brand and the space, not "Page not found"', async () => {
    fetchSpaceChild.mockResolvedValue({ kind: 'brand', space: SPACE, brand: BRAND });

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'helia', child: 'chanel' }),
    });
    expect(meta.title).toBe('Chanel — Helia | MiniRue');
  });
});

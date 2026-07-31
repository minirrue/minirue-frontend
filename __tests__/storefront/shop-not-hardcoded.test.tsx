import React from 'react';
import { render, screen } from '@testing-library/react';

/**
 * Task 19 — nothing about the shop area is hardcoded.
 *
 * `/products` used to say "All Perfumes" everywhere (metadata, breadcrumb,
 * heading) and every `/categories/[slug]` page built its breadcrumb from a
 * literal `Perfumes` crumb rather than the route and the category's own
 * ancestry — with a special case that only existed to suppress the duplicate
 * that hardcoding caused.
 *
 * The full pages also render `HeaderWrapper`/`FooterWithSettings`, which pull
 * in the app router and an async Client Component this test harness can't
 * mount — that's a pre-existing constraint on this app, unrelated to this
 * bug. So the exact logic that fixes the bug is tested directly instead: the
 * page's own `metadata` export (no literal category name anywhere), and the
 * `findCategoryPath` / `CategoryBreadcrumb` pair the category page now uses
 * to build its trail from the catalogue API's real parent/child data.
 */

// Both page modules import `next/server` (for `connection()`) at the top
// level, which touches Web APIs jsdom doesn't provide — this test never
// calls `connection()` itself, it only needs the pure helpers these modules
// export, so a minimal mock is enough to let the module load.
jest.mock('next/server', () => ({
  connection: jest.fn().mockResolvedValue(undefined),
}));

// generateMetadata now reads the admin-editable shop name (getShopName(),
// products-data.ts) rather than a hardcoded literal — mocked so this test
// never attempts a real fetch to the backend.
jest.mock('@/lib/api/storefront', () => {
  const actual = jest.requireActual('@/lib/api/storefront');
  return {
    ...actual,
    fetchStorefrontChrome: jest.fn().mockResolvedValue(actual.FALLBACK_CHROME),
  };
});

import { generateMetadata } from '@/app/products/page';
import { findCategoryPath, CategoryBreadcrumb } from '@/app/categories/[slug]/category-breadcrumb';
import type { Category } from '@/lib/api/catalog';

describe('the shop index (/products) says nothing about perfume', () => {
  it('has no literal category name in its metadata', async () => {
    // Task 10 turned the static `metadata` export into `generateMetadata`
    // (needed for the brand-filtered variants) — the unfiltered call is the
    // equivalent of the old static object this test used to read.
    const productsMetadata = await generateMetadata({ searchParams: Promise.resolve({}) });
    const text = JSON.stringify(productsMetadata);
    expect(text).not.toMatch(/perfume/i);
    expect(productsMetadata.title).toBe('All Products');
  });
});

describe('findCategoryPath — a category page\'s breadcrumb ancestry', () => {
  it('returns just the category for a top-level match', () => {
    const tree: Category[] = [
      { id: 'cat-1', slug: 'jewellery', name: 'Jewellery', parentId: null },
    ];
    const path = findCategoryPath(tree, 'jewellery');
    expect(path?.map((c) => c.name)).toEqual(['Jewellery']);
  });

  it('returns the full root-to-leaf chain for a nested category', () => {
    const tree: Category[] = [
      {
        id: 'cat-1',
        slug: 'jewellery',
        name: 'Jewellery',
        parentId: null,
        children: [{ id: 'cat-2', slug: 'rings', name: 'Rings', parentId: 'cat-1' }],
      },
    ];
    const path = findCategoryPath(tree, 'rings');
    expect(path?.map((c) => c.name)).toEqual(['Jewellery', 'Rings']);
  });

  it('returns null when no category has this slug', () => {
    const tree: Category[] = [
      { id: 'cat-1', slug: 'jewellery', name: 'Jewellery', parentId: null },
    ];
    expect(findCategoryPath(tree, 'nope')).toBeNull();
  });
});

describe('CategoryBreadcrumb — built from the route, never a fixed word', () => {
  it('reads Home / Shop / <category> for a top-level category', () => {
    render(<CategoryBreadcrumb ancestors={[]} displayName="Jewellery" />);
    const crumbs = screen.getAllByRole('listitem').map((n) => n.textContent);
    expect(crumbs).toEqual(['Home', 'Shop', 'Jewellery']);
    expect(crumbs.join(' ')).not.toMatch(/perfume/i);
  });

  it('reads Home / Shop / <parent> / <category> for a nested category', () => {
    const parent: Category = { id: 'cat-1', slug: 'jewellery', name: 'Jewellery', parentId: null };
    render(<CategoryBreadcrumb ancestors={[parent]} displayName="Rings" />);
    const crumbs = screen.getAllByRole('listitem').map((n) => n.textContent);
    expect(crumbs).toEqual(['Home', 'Shop', 'Jewellery', 'Rings']);
  });

  it('links "Shop" to /products and an ancestor to its own category page', () => {
    const parent: Category = { id: 'cat-1', slug: 'jewellery', name: 'Jewellery', parentId: null };
    render(<CategoryBreadcrumb ancestors={[parent]} displayName="Rings" />);
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: 'Jewellery' })).toHaveAttribute(
      'href',
      '/categories/jewellery',
    );
    // The final crumb is the current page — text, not a link.
    expect(screen.queryByRole('link', { name: 'Rings' })).not.toBeInTheDocument();
  });
});

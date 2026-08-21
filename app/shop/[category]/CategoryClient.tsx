'use client';

import React from 'react';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import ProductListingClient from '@/app/shop/all/ProductListingClient';
import type { ShopFacetOption } from '@/components/storefront/ShopFilterPanel';

interface CategoryClientProps {
  categoryId: string;
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
  brands?: ShopFacetOption[];
}

/**
 * A category listing IS the all-products listing with one filter already
 * applied, so it delegates rather than reimplementing.
 *
 * This file used to hold its own copy of the grid, its own `loadMore` and its
 * own state. That was fine while neither had filters; the moment both do, two
 * copies is how one of them ends up missing a facet, or keeps the "page two
 * forgets the filters" bug after the other is fixed. (It had that bug: its
 * loadMore passed `categoryId` but nothing else — correct only because there
 * was nothing else to pass.)
 *
 * Two differences are real and are passed as props:
 *
 *   - The category facet is hidden. The category is the PAGE; offering it as a
 *     filter would let a shopper pick a different one and land somewhere the
 *     heading and the breadcrumb both contradict.
 *   - The empty state sends them to the full shop, which is a better answer
 *     than "nothing here" when one category happens to be bare.
 */
export default function CategoryClient({
  categoryId,
  initialProducts,
  initialHasMore,
  initialCursor,
  brands = [],
}: CategoryClientProps) {
  return (
    <ProductListingClient
      initialProducts={initialProducts}
      initialHasMore={initialHasMore}
      initialCursor={initialCursor}
      // Pinned by the route, not chosen by the shopper — so it is a BASE
      // filter that survives every facet they change, never one of the facets.
      initialFilters={{ categoryId, limit: 24 }}
      brands={brands}
      showCategories={false}
      emptyMessage="No products in this category yet."
      emptyAction={
        <Link
          href="/shop/all"
          data-trace-id="PG-STOREFRONT-CAT-001::EL-LINK-browse-all-products"
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--mr-fg)',
            borderBottom: '1px solid var(--mr-gold-400)',
            paddingBottom: 2,
            textDecoration: 'none',
          }}
        >
          Browse all products →
        </Link>
      }
    />
  );
}

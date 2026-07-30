'use client';

import React from 'react';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';

/**
 * The products inside one of a space's own categories, or (Task 7,
 * 2026-07-30) one of its own brands, with load-more. Exactly one of
 * `categoryId`/`brandId` is set by the caller — this component just forwards
 * whichever one it got to `catalog.listProducts`.
 *
 * Lifted straight from BrandSectionClient, which did the same job for the old
 * /brands/<slug> page — same grid, same paging, same trace-id shape — so the
 * two pages behave identically and there is only ever one grid to maintain.
 */
interface SpaceCategoryClientProps {
  categoryId?: string;
  brandId?: string;
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
}

export default function SpaceCategoryClient({
  categoryId,
  brandId,
  initialProducts,
  initialHasMore,
  initialCursor,
}: SpaceCategoryClientProps) {
  const [products, setProducts] = React.useState(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await catalog.listProducts({
        categoryId,
        brandId,
        cursor,
        limit: 24,
      });
      setProducts((prev) => [...prev, ...res.data]);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <CatalogProductGrid
      products={products}
      hasMore={hasMore}
      onLoadMore={loadMore}
      loadingMore={loadingMore}
      emptyMessage={categoryId ? 'No products in this category yet.' : 'No products yet.'}
      listTraceId="PG-STOREFRONT-SPACE-002::EL-LIST-space-category-grid"
      cardTraceIdPrefix="PG-STOREFRONT-SPACE-002::EL-CARD-product-card"
      loadMoreTraceId="PG-STOREFRONT-SPACE-002::EL-BTN-load-more-products"
    />
  );
}

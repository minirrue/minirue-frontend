'use client';

import React from 'react';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct, ProductListFilters } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';

interface ProductListingClientProps {
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
  initialFilters: ProductListFilters;
}

/**
 * Storefront product listing.
 *
 * The hardcoded Gender filter bar (Men/Women/Unisex) was removed on
 * 2026-07-24: gender is no longer a fixed concept — product attributes are
 * admin-managed and free-entry now, so a filter baked into code no longer
 * fits. Real filters, driven by the actual attributes, will be added later;
 * for now the listing simply shows every product.
 */
export default function ProductListingClient({
  initialProducts,
  initialHasMore,
  initialCursor,
}: ProductListingClientProps) {
  const [products, setProducts] = React.useState<ApiProduct[]>(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await catalog.listProducts({ cursor, limit: 24 });
      setProducts((prev) => [...prev, ...res.data]);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      // silent — user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <CatalogProductGrid
        products={products}
        hasMore={hasMore}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        listTraceId="PG-STOREFRONT-CAT-003::EL-LIST-product-listing-grid"
        cardTraceIdPrefix="PG-STOREFRONT-CAT-003::EL-CARD-product-card"
        loadMoreTraceId="PG-STOREFRONT-CAT-003::EL-BTN-load-more-products"
        emptyMessage="No products available yet"
      />
    </div>
  );
}

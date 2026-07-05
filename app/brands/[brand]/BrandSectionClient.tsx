'use client';

import React from 'react';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';

interface BrandSectionClientProps {
  brand: string;
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
}

export default function BrandSectionClient({
  brand,
  initialProducts,
  initialHasMore,
  initialCursor,
}: BrandSectionClientProps) {
  const [products, setProducts] = React.useState(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await catalog.listProducts({ brand, cursor, limit: 24 });
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
      emptyMessage="No products yet from this brand."
    />
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';

interface CategoryClientProps {
  categoryId: string;
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
}

export default function CategoryClient({
  categoryId,
  initialProducts,
  initialHasMore,
  initialCursor,
}: CategoryClientProps) {
  const [products, setProducts] = React.useState<ApiProduct[]>(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await catalog.listProducts({ categoryId, cursor, limit: 24 });
      setProducts((prev) => [...prev, ...res.data]);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      // silent
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
      emptyMessage="No products in this category yet."
      listTraceId="PG-STOREFRONT-CAT-001::EL-LIST-category-product-grid"
      cardTraceIdPrefix="PG-STOREFRONT-CAT-001::EL-CARD-product-card"
      loadMoreTraceId="PG-STOREFRONT-CAT-001::EL-BTN-load-more-products"
      emptyAction={
        <Link
          href="/products"
          data-trace-id="PG-STOREFRONT-CAT-001::EL-LINK-browse-all-perfumes"
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
          Browse all perfumes →
        </Link>
      }
    />
  );
}

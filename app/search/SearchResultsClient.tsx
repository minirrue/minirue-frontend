'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';

interface SearchResultsClientProps {
  query: string;
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
}

export default function SearchResultsClient({
  query,
  initialProducts,
  initialHasMore,
  initialCursor,
}: SearchResultsClientProps) {
  const router = useRouter();
  const [products, setProducts] = React.useState<ApiProduct[]>(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await catalog.search(query.trim(), cursor);
      setProducts((prev) => [...prev, ...res.data]);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  if (!query.trim()) {
    return (
      <div
        data-trace-id="PG-STOREFRONT-CAT-004::EL-REGION-empty-search-prompt"
        style={{
          textAlign: 'center',
          padding: 'var(--mr-sp-9) 0',
          color: 'var(--mr-fg-3)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontStyle: 'italic',
            fontSize: 'var(--mr-text-xl)',
            margin: '0 0 var(--mr-sp-5)',
          }}
        >
          Enter a search term above to find fragrances.
        </p>
        <Link
          href="/products"
          data-trace-id="PG-STOREFRONT-CAT-004::EL-LINK-browse-all-perfumes-from-search"
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
      </div>
    );
  }

  return (
    <CatalogProductGrid
      products={products}
      hasMore={hasMore}
      onLoadMore={loadMore}
      loadingMore={loadingMore}
      listTraceId="PG-STOREFRONT-CAT-004::EL-LIST-search-results-grid"
      cardTraceIdPrefix="PG-STOREFRONT-CAT-004::EL-CARD-product-card"
      loadMoreTraceId="PG-STOREFRONT-CAT-004::EL-BTN-load-more-search-results"
      emptyMessage="No products match your search"
      emptyAction={
        <button
          type="button"
          data-trace-id="PG-STOREFRONT-CAT-004::EL-BTN-clear-search"
          onClick={() => router.push('/search')}
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--mr-fg)',
            borderBottom: '1px solid var(--mr-gold-400)',
            paddingBottom: 2,
          }}
        >
          Clear search
        </button>
      }
    />
  );
}

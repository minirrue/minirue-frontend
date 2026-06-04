'use client';

import React from 'react';
import Link from 'next/link';
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
      emptyMessage={`No results for "${query}"`}
      emptyAction={
        <Link
          href="/products"
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

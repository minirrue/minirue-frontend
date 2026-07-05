'use client';

import React from 'react';
import Link from 'next/link';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct, ProductListFilters } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';
import CatalogProductGridSkeleton from '@/components/storefront/CatalogProductGridSkeleton';

interface ProductListingClientProps {
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
  initialFilters: ProductListFilters;
}

const GENDER_OPTIONS: Array<{ label: string; value: '' | 'men' | 'women' | 'unisex' }> = [
  { label: 'All', value: '' },
  { label: 'Men', value: 'men' },
  { label: 'Women', value: 'women' },
  { label: 'Unisex', value: 'unisex' },
];

export default function ProductListingClient({
  initialProducts,
  initialHasMore,
  initialCursor,
  initialFilters,
}: ProductListingClientProps) {
  const [products, setProducts] = React.useState<ApiProduct[]>(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [gender, setGender] = React.useState<'' | 'men' | 'women' | 'unisex'>(
    (initialFilters.gender as '' | 'men' | 'women' | 'unisex') ?? '',
  );
  const [filtering, setFiltering] = React.useState(false);

  const applyGenderFilter = async (value: '' | 'men' | 'women' | 'unisex') => {
    setGender(value);
    setFiltering(true);
    try {
      const res = await catalog.listProducts({
        gender: value || undefined,
        limit: 24,
      });
      setProducts(res.data);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      // keep existing products on filter failure
    } finally {
      setFiltering(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await catalog.listProducts({
        gender: gender || undefined,
        cursor,
        limit: 24,
      });
      setProducts((prev) => [...prev, ...res.data]);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      // silent — user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const resetFilters = () => applyGenderFilter('');

  return (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mr-sp-2)',
          flexWrap: 'wrap',
          marginBottom: 'var(--mr-sp-7)',
          paddingBottom: 'var(--mr-sp-5)',
          borderBottom: '1px solid var(--mr-hairline)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--mr-fg-4)',
            marginRight: 'var(--mr-sp-3)',
          }}
        >
          Filter
        </span>

        {/* Gender pills */}
        <div style={{ display: 'flex', gap: 'var(--mr-sp-2)' }}>
          {GENDER_OPTIONS.map((opt) => {
            const active = gender === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => applyGenderFilter(opt.value)}
                disabled={filtering}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--mr-radius-pill)',
                  border: `1px solid ${active ? 'var(--mr-fg)' : 'var(--mr-border)'}`,
                  background: active ? 'var(--mr-fg)' : 'transparent',
                  color: active ? 'var(--mr-bg-raised)' : 'var(--mr-fg-2)',
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  cursor: filtering ? 'default' : 'pointer',
                  transition: 'all var(--mr-dur-fast) var(--mr-ease-spring)',
                  opacity: filtering ? 0.6 : 1,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {filtering ? (
        <CatalogProductGridSkeleton count={8} />
      ) : (
        <CatalogProductGrid
          products={products}
          hasMore={hasMore}
          onLoadMore={loadMore}
          loadingMore={loadingMore}
          emptyMessage={
            gender
              ? 'No perfumes match these filters.'
              : 'No products available yet'
          }
          emptyAction={
            gender ? (
              <button
                onClick={resetFilters}
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
                Reset filters
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

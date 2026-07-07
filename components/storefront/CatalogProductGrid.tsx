'use client';

import React from 'react';
import type { ApiProduct } from '@/lib/api/catalog';
import CatalogProductCard from './CatalogProductCard';

interface CatalogProductGridProps {
  products: ApiProduct[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  /** RULEBOOK §27 — full data-trace-id for this grid's LIST region, e.g.
   * "PG-STOREFRONT-CAT-001::EL-LIST-category-product-grid". Caller-supplied because this
   * component is reused across multiple pages, each with its own PG-* id. */
  listTraceId?: string;
  /** §27 — data-trace-id PREFIX for each card, e.g. "PG-STOREFRONT-CAT-001::EL-CARD-product-card"
   * — CatalogProductCard appends "@{slug}" itself since it owns the instance key. */
  cardTraceIdPrefix?: string;
  /** §27 — full data-trace-id for the "Load more" button. */
  loadMoreTraceId?: string;
}

export default function CatalogProductGrid({
  products,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  emptyMessage = 'No products found.',
  emptyAction,
  listTraceId,
  cardTraceIdPrefix,
  loadMoreTraceId,
}: CatalogProductGridProps) {
  if (!products.length) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--mr-sp-9) var(--mr-gutter)',
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
          {emptyMessage}
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div>
      <div
        data-trace-id={listTraceId}
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: 'clamp(var(--mr-sp-4), 3vw, var(--mr-sp-6))',
        }}
      >
        {products.map((p, i) => (
          <CatalogProductCard
            key={p.id}
            product={p}
            index={i}
            traceIdPrefix={cardTraceIdPrefix}
          />
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 'var(--mr-sp-8)',
          }}
        >
          <button
            data-trace-id={loadMoreTraceId}
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{
              padding: '14px 40px',
              background: 'transparent',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-pill)',
              cursor: loadingMore ? 'default' : 'pointer',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: loadingMore ? 'var(--mr-fg-4)' : 'var(--mr-fg)',
              transition: 'all var(--mr-dur-fast) var(--mr-ease-out)',
              opacity: loadingMore ? 0.6 : 1,
            }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

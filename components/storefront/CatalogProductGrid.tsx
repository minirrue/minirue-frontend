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
}

export default function CatalogProductGrid({
  products,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  emptyMessage = 'No products found.',
  emptyAction,
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
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: 'clamp(var(--mr-sp-4), 3vw, var(--mr-sp-6))',
        }}
      >
        {products.map((p, i) => (
          <CatalogProductCard key={p.id} product={p} index={i} />
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

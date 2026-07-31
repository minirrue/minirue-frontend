'use client';

import React from 'react';
import Link from 'next/link';
import { useWishlistProducts } from '@/lib/hooks/use-wishlist';
import ProductCard from '@/components/storefront/ProductCard';

function SavedSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))',
        gap: 20,
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className="mr-skeleton-pulse"
          style={{
            display: 'block',
            aspectRatio: '3/4',
            borderRadius: 'var(--mr-radius-md)',
            background: 'var(--mr-bg-raised)',
          }}
        />
      ))}
    </div>
  );
}

export default function SavedPageClient() {
  const { data: products, isLoading, isError, refetch } = useWishlistProducts();

  return (
    <>
      <h1
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xl)',
          fontWeight: 600,
          margin: '0 0 28px',
          color: 'var(--mr-fg)',
        }}
      >
        Saved
      </h1>

      {isLoading && <SavedSkeleton />}

      {isError && (
        <div style={{ color: 'var(--mr-fg-2)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 12px' }}>
            We could not load your saved products just now.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            style={{
              padding: '12px 20px',
              minHeight: 44,
              borderRadius: 'var(--mr-radius-pill)',
              border: '1px solid var(--mr-border)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg)',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Never a bare empty panel: say what goes here and give a way to fill it. */}
      {!isLoading && !isError && !products?.length && (
        <div style={{ color: 'var(--mr-fg-2)', lineHeight: 1.7, maxWidth: '52ch' }}>
          <p style={{ margin: '0 0 16px' }}>
            Nothing saved yet. Tap the heart on anything you want to come back
            to, and it will be waiting here — on this device or any other.
          </p>
          <Link
            href="/products"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '12px 22px',
              minHeight: 44,
              borderRadius: 'var(--mr-radius-pill)',
              background: 'var(--mr-ink-900)',
              color: 'var(--mr-cream-100)',
              textDecoration: 'none',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Browse the collection
          </Link>
        </div>
      )}

      {!isLoading && !isError && !!products?.length && (
        <div
          data-trace-id="PG-STOREFRONT-ACCOUNT-006::EL-REGION-saved-products"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))',
            gap: 20,
          }}
        >
          {products.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              index={i}
              traceIdPrefix="PG-STOREFRONT-ACCOUNT-006::EL-CARD-saved-product"
            />
          ))}
        </div>
      )}
    </>
  );
}

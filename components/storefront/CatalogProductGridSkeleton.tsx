'use client';

import React from 'react';

interface CatalogProductGridSkeletonProps {
  count?: number;
}

export default function CatalogProductGridSkeleton({
  count = 8,
}: CatalogProductGridSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading products"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
        gap: 'clamp(var(--mr-sp-4), 3vw, var(--mr-sp-6))',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mr-sp-4)',
          }}
        >
          <div
            className="mr-skeleton-pulse"
            style={{
              aspectRatio: '4/5',
              borderRadius: 'var(--mr-radius-lg)',
              background: 'var(--mr-cream-300)',
            }}
          />
          <div
            className="mr-skeleton-pulse"
            style={{
              height: 14,
              width: '72%',
              borderRadius: 4,
              background: 'var(--mr-cream-300)',
            }}
          />
          <div
            className="mr-skeleton-pulse"
            style={{
              height: 12,
              width: '40%',
              borderRadius: 4,
              background: 'var(--mr-cream-300)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

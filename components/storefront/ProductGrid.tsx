'use client';

import React from 'react';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import type { ResolvedBrandCard, ResolvedProduct } from '@/lib/api/storefront';
import ProductCard from './ProductCard';
import { useScrollReveal } from '@/lib/motion/hooks';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { useProductGridTracking } from './useProductGridTracking';

interface ProductGridProps {
  eyebrow: string;
  title: string;
  products: ResolvedProduct[];
  brands: ResolvedBrandCard[];
  display: 'products' | 'brands';
  viewAllHref: string | null;
  /** analytics — `product_impression`/`product_click`'s `listId`. Defaults to
   * a slug of `title` (this grid has no other stable id to reuse) so no
   * caller needs to change to get impressions wired. */
  listId?: string;
}

export default function ProductGrid({
  eyebrow,
  title,
  products,
  brands,
  display,
  viewAllHref,
  listId,
}: ProductGridProps) {
  const head = useScrollReveal({ from: { y: 20, opacity: 0, scale: 1 } });
  const { mobile, w } = useBreakpoint();
  const cols = mobile ? 2 : w < 900 ? 3 : 4;
  const resolvedListId =
    listId ?? title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Brand tiles have no productId, so they never enter the impression pool.
  const trackableProducts = display === 'products' ? products : [];
  const { gridRef, impressionProps } = useProductGridTracking(
    trackableProducts as unknown as { id: string }[],
    resolvedListId,
  );

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,8vw,96px) var(--mr-gutter)' }}>
      <div
        ref={head.ref}
        style={{
          ...head.style,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 48,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mr-ink-500)', marginBottom: 14 }}>
            {eyebrow}
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1.08, letterSpacing: '-0.006em', margin: 0, color: 'var(--mr-ink-900)' }}>
            {title}
          </h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mr-ink-900)', borderBottom: '1px solid var(--mr-gold-400)', paddingBottom: 2, cursor: 'pointer', textDecoration: 'none' }}
          >
            View all <span className="mr-link-arrow">→</span>
          </Link>
        )}
      </div>
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols},1fr)`,
          gap: 'clamp(16px,3vw,32px)',
        }}
      >
        {display === 'brands'
          ? brands.map((b) => (
              <Link
                key={b.id}
                href={b.href}
                style={{
                  display: 'block',
                  padding: '28px 22px',
                  border: '1px solid var(--mr-hairline)',
                  borderRadius: 'var(--mr-radius-md)',
                  textDecoration: 'none',
                  color: 'var(--mr-ink-900)',
                }}
              >
                <div style={{ fontFamily: 'var(--mr-font-serif)', fontSize: 22, marginBottom: 6 }}>
                  {b.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mr-ink-500)' }}>
                  {b.productCount} {b.productCount === 1 ? 'item' : 'items'}
                </div>
              </Link>
            ))
          : products.map((p, i) => (
              <div key={p.id as string} {...impressionProps(p.id as string, i)}>
                <ProductCard
                  product={p as unknown as ApiProduct}
                  index={i}
                />
              </div>
            ))}
      </div>
    </section>
  );
}

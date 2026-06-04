'use client';

import React from 'react';
import type { ApiProduct } from '@/lib/api/catalog';
import ProductCard from './ProductCard';
import { useScrollReveal } from '@/lib/motion/hooks';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

interface ProductGridProps {
  eyebrow: string;
  title: string;
  products: ApiProduct[];
  onSelect: (product: ApiProduct) => void;
}

export default function ProductGrid({ eyebrow, title, products, onSelect }: ProductGridProps) {
  const head = useScrollReveal({ from: { y: 20, opacity: 0, scale: 1 } });
  const { mobile, w } = useBreakpoint();
  const cols = mobile ? 2 : w < 900 ? 3 : 4;

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
        <a href="/products" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mr-ink-900)', borderBottom: '1px solid var(--mr-gold-400)', paddingBottom: 2, cursor: 'pointer', textDecoration: 'none' }}>
          View all <span className="mr-link-arrow">→</span>
        </a>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols},1fr)`,
          gap: 'clamp(16px,3vw,32px)',
        }}
      >
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} onClick={() => onSelect(p)} />
        ))}
      </div>
    </section>
  );
}

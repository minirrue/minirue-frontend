'use client';

import React from 'react';
import type { ApiProduct } from '@/lib/api/catalog';
import { primaryMedia, cloudinaryUrl, lowestPrice } from '@/lib/api/catalog';
import IconButton from '@/components/ui/IconButton';
import { useStaggerEnter } from '@/lib/motion/hooks';
import { MR_TX } from '@/lib/motion/presets';

interface ProductCardProps {
  product: ApiProduct;
  index?: number;
  onClick?: () => void;
}

export default function ProductCard({ product, index = 0, onClick }: ProductCardProps) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const enter = useStaggerEnter(index, { preset: 'default', step: 55, from: { y: 20, opacity: 0, scale: 0.96 } });

  const media = primaryMedia(product);
  const imgSrc = media ? cloudinaryUrl(media.cloudinaryPublicId, { w: 600, h: 750 }) : null;
  const price = lowestPrice(product);
  const meta = [product.brand, product.fragranceFamily].filter(Boolean).join(' · ');

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, ...enter }}
    >
      {/* Tile */}
      <div
        style={{
          aspectRatio: '3/4',
          background: 'var(--mr-cream-300)',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--mr-radius-lg)',
          boxShadow: hover ? 'var(--mr-shadow-lg)' : 'var(--mr-shadow-sm)',
          transform: press
            ? 'translate3d(0,-1px,0) scale(0.98)'
            : hover
            ? 'translate3d(0,-6px,0)'
            : 'translate3d(0,0,0)',
          transition: press
            ? MR_TX.press
            : 'transform var(--mp-dur-hover) var(--mr-ease-spring), box-shadow var(--mp-dur-hover) var(--mr-ease-out)',
        }}
      >
        {/* Product image */}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={media?.altText || product.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: hover ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 700ms cubic-bezier(0.16,0.84,0.44,1)',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 'clamp(11px,2vw,14px)',
              color: 'var(--mr-ink-400)',
              letterSpacing: '0.04em',
              textAlign: 'center',
              padding: 16,
            }}
          >
            {product.name}
          </div>
        )}

        {/* Wishlist on hover */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            opacity: hover ? 1 : 0,
            transform: hover ? 'scale(1)' : 'scale(0.85)',
            transition: 'opacity 220ms var(--mr-ease-out), transform 240ms var(--mr-ease-spring)',
          }}
        >
          <IconButton icon="heart" size={34} tone="cream" label="Save" />
        </div>

        {/* Quick view pill */}
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            opacity: hover ? 1 : 0,
            transform: hover ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 220ms var(--mr-ease-out), transform 260ms var(--mr-ease-spring)',
          }}
        >
          <div
            style={{
              background: 'rgba(253,251,245,0.96)',
              backdropFilter: 'blur(8px)',
              color: 'var(--mr-ink-900)',
              borderRadius: 'var(--mr-radius-pill)',
              padding: '10px 16px',
              fontFamily: 'Jost, sans-serif',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              textAlign: 'center',
              boxShadow: 'var(--mr-shadow-md)',
            }}
          >
            Quick view →
          </div>
        </div>
      </div>

      {/* Meta */}
      <div>
        <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 15, color: 'var(--mr-ink-900)', marginBottom: 3 }}>
          {product.name}
        </div>
        {meta && (
          <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-400)', letterSpacing: '0.02em' }}>
            {meta}
          </div>
        )}
        {price && (
          <div style={{ marginTop: 9, fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: 17, color: 'var(--mr-ink-900)', fontVariantNumeric: 'oldstyle-nums tabular-nums' }}>
            {price.currency} {price.amount}
          </div>
        )}
      </div>
    </div>
  );
}

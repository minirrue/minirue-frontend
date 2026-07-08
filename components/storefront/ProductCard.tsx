'use client';

import React from 'react';
import Image from 'next/image';
import type { ApiProduct } from '@/lib/api/catalog';
import { primaryMedia, mediaImageUrl, lowestPrice } from '@/lib/api/catalog';
import IconButton from '@/components/ui/IconButton';
import { MR_TX } from '@/lib/motion/presets';
import { useIsTouch } from '@/lib/hooks/useIsTouch';

interface ProductCardProps {
  product: ApiProduct;
  index?: number;
  onClick?: () => void;
  /** RULEBOOK §27 — data-trace-id PREFIX for this card, e.g.
   * "PG-STOREFRONT-COLLAB-001::EL-CARD-product-card"; the product id is appended as the
   * repeating-element instance key ("@{product.id}"). Undefined = no attribute rendered
   * (kept optional since this card is also reused by other, not-yet-instrumented grids). */
  traceIdPrefix?: string;
}

function ProductCard({ product, index = 0, onClick, traceIdPrefix }: ProductCardProps) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const isTouch = useIsTouch();
  const [revealed, setRevealed] = React.useState(false);

  const media = React.useMemo(() => primaryMedia(product), [product]);
  const imgSrc = React.useMemo(
    () => (media ? mediaImageUrl(media, { w: 600, h: 750 }) : null),
    [media],
  );
  const price = React.useMemo(() => lowestPrice(product), [product]);
  const meta = React.useMemo(
    () => [product.brand, product.fragranceFamily].filter(Boolean).join(' · '),
    [product.brand, product.fragranceFamily],
  );

  const showOverlays = React.useMemo(
    () => hover || (isTouch && revealed),
    [hover, isTouch, revealed],
  );

  const handleCardClick = React.useCallback(() => {
    if (isTouch && !revealed) {
      setRevealed(true);
      return;
    }
    if (isTouch) setRevealed(false);
    onClick?.();
  }, [isTouch, revealed, onClick]);

  const handleMouseEnter = React.useCallback(() => setHover(true), []);
  const handleMouseLeave = React.useCallback(() => {
    setHover(false);
    setPress(false);
    setRevealed(false);
  }, []);
  const handleMouseDown = React.useCallback(() => setPress(true), []);
  const handleMouseUp = React.useCallback(() => setPress(false), []);

  // CSS-based staggered entrance — replaces RAF spring loops.
  // Initial state: hidden + shifted down. On mount, entered flips to true
  // which applies the final state and CSS transitions animate the change.
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(t);
  }, []);

  const staggerDelay = index * 50;
  const enterStyle: React.CSSProperties = {
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 400ms ease-out ${staggerDelay}ms, transform 400ms ease-out ${staggerDelay}ms`,
  };

  return (
    <div
      data-trace-id={traceIdPrefix ? `${traceIdPrefix}@${product.id}` : undefined}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, ...enterStyle }}
    >
      {/* Tile */}
      <div
        style={{
          aspectRatio: '3/4',
          background: 'var(--mr-cream-300)',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--mr-radius-lg)',
          boxShadow: showOverlays ? 'var(--mr-shadow-lg)' : 'var(--mr-shadow-sm)',
          transform: press
            ? 'translate3d(0,-1px,0) scale(0.98)'
            : showOverlays
            ? 'translate3d(0,-6px,0)'
            : 'translate3d(0,0,0)',
          transition: press
            ? MR_TX.press
            : 'transform var(--mp-dur-hover) var(--mr-ease-spring), box-shadow var(--mp-dur-hover) var(--mr-ease-out)',
        }}
      >
        {/* Product image */}
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={media?.altText || product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            style={{
              objectFit: 'cover',
              transform: showOverlays ? 'scale(1.04)' : 'scale(1)',
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

        {/* Wishlist — shown on hover (desktop) or revealed (touch) */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            opacity: showOverlays ? 1 : 0,
            transform: showOverlays ? 'scale(1)' : 'scale(0.85)',
            transition: 'opacity 220ms var(--mr-ease-out), transform 240ms var(--mr-ease-spring)',
            pointerEvents: showOverlays ? 'auto' : 'none',
          }}
        >
          <span onClick={(e) => e.stopPropagation()}>
            <IconButton icon="heart" size={34} tone="cream" label="Save" />
          </span>
        </div>

        {/* Quick view pill */}
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            opacity: showOverlays ? 1 : 0,
            transform: showOverlays ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 220ms var(--mr-ease-out), transform 260ms var(--mr-ease-spring)',
            pointerEvents: showOverlays ? 'auto' : 'none',
          }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); }}
            style={{
              background: 'rgba(11, 11, 11, 0.6)',
              color: 'var(--mr-cream-100)',
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

export default React.memo(ProductCard);

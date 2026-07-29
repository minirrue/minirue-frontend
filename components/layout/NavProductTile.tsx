'use client';

/**
 * NavProductTile — the product picture used inside navigation, in both the
 * desktop category dropdown and the mobile menu sheet.
 *
 * Deliberately NOT CatalogProductCard: that card owns a hover-lift, a quick-view
 * pill and a 4/5 tile sized for a results grid, all of which fight a menu panel
 * that is itself animating in. This is the same data, drawn as a menu row/tile.
 */

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import { mediaImageUrl, primaryMedia, lowestPrice, productByline } from '@/lib/api/catalog';
import PriceDisplay from '@/components/storefront/PriceDisplay';

interface NavProductTileProps {
  product: ApiProduct;
  /** `tile` = stacked image-over-caption (desktop dropdown, mobile grid).
   *  `row` = thumbnail beside text (compact mobile list). */
  layout?: 'tile' | 'row';
  /** Drives the staggered reveal; the panel owns the timing, the tile owns the transform. */
  revealed?: boolean;
  index?: number;
  onNavigate?: () => void;
}

/** Reveal starts once the panel is roughly half-open, then each tile follows.
 *  Capped so a full menu never crawls in for more than a second. */
function revealDelay(index: number): string {
  return `${Math.min(300 + index * 100, 900)}ms`;
}

export default function NavProductTile({
  product,
  layout = 'tile',
  revealed = true,
  index = 0,
  onNavigate,
}: NavProductTileProps) {
  const media = primaryMedia(product);
  const price = lowestPrice(product);
  const src = media ? mediaImageUrl(media, { w: 480, h: 600 }) : null;
  const alt = media?.altText ?? product.name;
  const byline = productByline(product) || product.categoryName || '';

  const reveal: React.CSSProperties = {
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'translateY(0)' : 'translateY(20px)',
    transition:
      'transform 600ms cubic-bezier(0.075,0.82,0.165,1), opacity 600ms cubic-bezier(0.19,1,0.22,1)',
    transitionDelay: revealed ? revealDelay(index) : '0ms',
  };

  if (layout === 'row') {
    return (
      <Link
        href={`/products/${product.slug}`}
        onClick={onNavigate}
        data-trace-id={`PG-STOREFRONT-NAV-001::EL-LINK-nav-product@${product.slug}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 0',
          borderBottom: '1px solid var(--mr-hairline)',
          textDecoration: 'none',
          color: 'inherit',
          ...reveal,
        }}
      >
        <span
          style={{
            position: 'relative',
            flex: '0 0 auto',
            width: 64,
            height: 80,
            borderRadius: 'var(--mr-radius-md)',
            overflow: 'hidden',
            background: 'var(--mr-cream-300)',
          }}
        >
          {src && (
            <Image src={src} alt={alt} fill sizes="64px" style={{ objectFit: 'cover' }} />
          )}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-base)',
              fontWeight: 500,
              color: 'var(--mr-fg)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {product.name}
          </span>
          {byline && (
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-4)',
                margin: '2px 0 4px',
              }}
            >
              {byline}
            </span>
          )}
          {price && (
            <PriceDisplay
              amount={price.amount}
              currency={price.currency}
              style={{ fontSize: 'var(--mr-text-base)' }}
            />
          )}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      onClick={onNavigate}
      data-trace-id={`PG-STOREFRONT-NAV-001::EL-LINK-nav-product@${product.slug}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        ...reveal,
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'block',
          aspectRatio: '4/5',
          borderRadius: 'var(--mr-radius-lg)',
          overflow: 'hidden',
          background: 'var(--mr-cream-300)',
          marginBottom: 10,
        }}
      >
        {src && (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 640px) 45vw, 220px"
            style={{ objectFit: 'cover' }}
          />
        )}
      </span>
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 'var(--mr-text-base)',
          fontWeight: 500,
          color: 'var(--mr-fg)',
        }}
      >
        {product.name}
      </span>
      {price && (
        <PriceDisplay
          amount={price.amount}
          currency={price.currency}
          style={{ fontSize: 'var(--mr-text-base)', marginTop: 2 }}
        />
      )}
    </Link>
  );
}

'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import { mediaImageUrl, primaryMedia, lowestPrice } from '@/lib/api/catalog';
import PriceDisplay from './PriceDisplay';

interface CatalogProductCardProps {
  product: ApiProduct;
  index?: number;
  /** RULEBOOK §27 — data-trace-id PREFIX for this card, e.g.
   * "PG-STOREFRONT-CAT-001::EL-CARD-product-card"; the product slug is appended as the
   * repeating-element instance key ("@{slug}"). Undefined = no attribute rendered. */
  traceIdPrefix?: string;
}

export default function CatalogProductCard({ product, index = 0, traceIdPrefix }: CatalogProductCardProps) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const media = primaryMedia(product);
  const price = lowestPrice(product);

  const imgSrc = media ? mediaImageUrl(media, { w: 600, h: 750 }) : null;

  const imgAlt = media?.altText ?? product.name;

  return (
    <Link
      href={`/products/${product.slug}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <article
        data-trace-id={traceIdPrefix ? `${traceIdPrefix}@${product.slug}` : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setPress(false); }}
        onMouseDown={() => setPress(true)}
        onMouseUp={() => setPress(false)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--mr-sp-4)',
          opacity: 0,
          animation: `mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) ${index * 55}ms both`,
        }}
      >
        {/* Image tile */}
        <div
          style={{
            aspectRatio: '4/5',
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
              ? `transform var(--mr-dur-instant) var(--mr-ease-snappy), box-shadow var(--mr-dur-instant)`
              : `transform var(--mp-dur-hover) var(--mr-ease-spring), box-shadow var(--mp-dur-hover) var(--mr-ease-out)`,
          }}
        >
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={imgAlt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              style={{
                objectFit: 'cover',
                transform: hover ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 700ms cubic-bezier(0.16,0.84,0.44,1)',
              }}
            />
          ) : (
            /* Placeholder when no Cloudinary image */
            <div
              style={{
                inset: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--mr-fg-4)',
                fontFamily: 'var(--mr-font-serif)',
                fontStyle: 'italic',
                fontSize: 'var(--mr-text-sm)',
              }}
            >
              {product.name}
            </div>
          )}

          {/* Quick view pill */}
          <div
            style={{
              position: 'absolute',
              left: 'var(--mr-sp-3)',
              right: 'var(--mr-sp-3)',
              bottom: 'var(--mr-sp-3)',
              opacity: hover ? 1 : 0,
              transform: hover ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out), transform var(--mr-dur-fast) var(--mr-ease-spring)',
            }}
          >
            <div
              style={{
                background: 'rgba(253,251,245,0.96)',
                backdropFilter: 'blur(8px)',
                color: 'var(--mr-ink-900)',
                borderRadius: 'var(--mr-radius-pill)',
                padding: '10px 16px',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                textAlign: 'center',
                boxShadow: 'var(--mr-shadow-md)',
              }}
            >
              View product →
            </div>
          </div>
        </div>

        {/* Meta */}
        <div>
          <div
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-base)',
              color: 'var(--mr-fg)',
              marginBottom: 'var(--mr-sp-1)',
              fontWeight: 500,
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
              letterSpacing: '0.02em',
              marginBottom: 'var(--mr-sp-2)',
            }}
          >
            {product.brand} · {product.fragranceFamily}
          </div>
          {price && (
            <PriceDisplay amount={price.amount} currency={price.currency} />
          )}
        </div>
      </article>
    </Link>
  );
}

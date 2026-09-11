'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import { mediaImageUrl, primaryMedia, lowestPrice, productByline, productInStock } from '@/lib/api/catalog';
import PriceDisplay from './PriceDisplay';
import { useDiscountedPrice } from '@/lib/hooks/use-sitewide-discount';
import { productPath } from '@/lib/routes';
import { usePrefetchOnIntent } from '@/lib/hooks/usePrefetchOnIntent';

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

  // Warm the product page on intent rather than on viewport — see
  // usePrefetchOnIntent for why a 24-card grid must not prefetch eagerly.
  const href = productPath(product);
  const prefetchProps = usePrefetchOnIntent(href);

  const media = primaryMedia(product);
  const price = lowestPrice(product);
  // Same predicate ProductSchema/CollectionSchema use for JSON-LD availability —
  // a sold-out grid card and a sold-out rich-result must never disagree.
  const soldOut = !productInStock(product);

  const imgSrc = media ? mediaImageUrl(media, { w: 600, h: 750 }) : null;

  const imgAlt = media?.altText ?? product.name;

  return (
    <Link
      href={href}
      {...prefetchProps}
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
                opacity: soldOut ? 0.6 : 1,
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
                opacity: soldOut ? 0.6 : 1,
              }}
            >
              {product.name}
            </div>
          )}

          {/* Sold-out badge — always on, not hover-gated, since a shopper
              scanning a grid never hovers most of the tiles they pass over.
              Dashed border and "Out of stock" wording reuse VariantPicker's
              sold-out pill and the product page's disabled-CTA copy, so the
              refusal reads the same way everywhere it appears. The text
              itself carries the meaning for screen readers, not just the
              dimmed image. The link stays enabled underneath — the shopper
              can still open the product and pick a different size. */}
          {soldOut && (
            <div
              style={{
                position: 'absolute',
                top: 'var(--mr-sp-3)',
                left: 'var(--mr-sp-3)',
                background: 'var(--mr-bg-raised)',
                color: 'var(--mr-fg-2)',
                border: '1px dashed var(--mr-border)',
                borderRadius: 'var(--mr-radius-pill)',
                padding: '6px 14px',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                boxShadow: 'var(--mr-shadow-sm)',
              }}
            >
              Out of stock
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
            {productByline(product) || product.categoryName}
          </div>
          {price && <CardPrice price={price} product={product} />}
        </div>
      </article>
    </Link>
  );
}

/**
 * Split out because a hook cannot be called inside the `price &&` branch above.
 * Renders exactly as before when no markdown is running: `useDiscountedPrice`
 * returns `wasAmount: undefined`, which is what an ordinary price already is.
 */
function CardPrice({
  price,
  product,
}: {
  price: { amount: string; currency: string };
  product: ApiProduct;
}) {
  // The server's answer, not `!product.collaboratorId`. Ownership is the
  // product AND its brand, and only the API sees both — this local check
  // struck through prices on partner-brand products that checkout charged in
  // full (#3). `?? false` so an older response without the field shows the
  // real price rather than a discount that will not be honoured.
  const shown = useDiscountedPrice(price.amount, product.isMinirueOwned ?? false);
  return (
    <PriceDisplay
      amount={shown.amount}
      wasAmount={shown.wasAmount}
      currency={price.currency}
    />
  );
}

'use client';

import React from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'motion/react';
import type { ApiProduct, MediaAsset } from '@/lib/api/catalog';
import { mediaImageUrl } from '@/lib/api/catalog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNavigation,
} from '@/components/core/carousel';

interface ProductGalleryProps {
  product: ApiProduct;
  /** Cover first, then the product's other photographs. */
  items: MediaAsset[];
}

/**
 * Every photograph on a product, in one carousel, at every width. Before this
 * a phone got a dotless swipe strip (nothing on screen said a second photo
 * existed) and a laptop got a stack of full-height slabs you had to scroll
 * past one by one.
 */
export default function ProductGallery({ product, items }: ProductGalleryProps) {
  const [index, setIndex] = React.useState(0);
  const reduceMotion = useReducedMotion();

  // The house slide feel; instant for anyone who asked for less movement.
  const transition = reduceMotion
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 220, damping: 30, mass: 0.9 } as const);

  const total = items.length;
  const single = total <= 1;

  return (
    <div
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-carousel"
      className="relative"
      style={{ background: 'var(--mr-cream-300)' }}
    >
      <Carousel
        index={index}
        onIndexChange={setIndex}
        // One photograph is not a carousel: no drag, no dots, no arrows.
        disableDrag={single}
      >
        <CarouselContent transition={transition}>
          {items.map((m, i) => {
            const src = mediaImageUrl(m, { w: 1400, h: 1750 });
            if (!src) return null;
            return (
              <CarouselItem key={m.id} className="p-0">
                <div
                  data-trace-id={`PG-STOREFRONT-CAT-005::EL-IMG-product-carousel-image@${m.id}`}
                  className="relative aspect-[4/5] w-full lg:aspect-auto lg:h-screen"
                >
                  <Image
                    src={src}
                    alt={m.altText ?? product.name}
                    fill
                    priority={i === 0}
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    style={{ objectFit: 'cover' }}
                    // Dragging an image drags the browser's own ghost preview
                    // instead of the carousel.
                    draggable={false}
                  />
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        {!single && (
          <CarouselNavigation
            // Fine pointers only — on a phone the swipe is the control, and
            // arrows would sit on top of the photograph for no reason.
            className="hidden left-0 w-full px-4 [@media(pointer:fine)]:flex"
            classNameButton="p-3 text-[var(--mr-cream-100)] bg-[rgba(11,11,11,0.45)] hover:bg-[rgba(11,11,11,0.65)] backdrop-blur-sm"
          />
        )}
      </Carousel>

      {!single && (
        // Below the photo on a phone (never covering it), floating over the
        // bottom of the full-height frame on a laptop. An ink scrim rather
        // than glass: the photograph underneath is unknown, and this has to
        // stay legible over every one of them.
        <div className="relative flex items-center justify-center gap-4 py-4 lg:absolute lg:bottom-8 lg:left-1/2 lg:z-10 lg:-translate-x-1/2 lg:rounded-full lg:px-5 lg:py-3">
          {/* The scrim only exists where the row sits on a photograph. */}
          <div
            className="absolute inset-0 hidden rounded-full lg:block"
            style={{ background: 'rgba(11,11,11,0.55)' }}
          />
          <div className="relative flex items-center gap-1">
            {items.map((m, i) => (
              <button
                key={m.id}
                type="button"
                data-trace-id={`PG-STOREFRONT-CAT-005::EL-BTN-gallery-dot@${m.id}`}
                aria-label={`Go to photo ${i + 1} of ${total}`}
                aria-current={index === i}
                onClick={() => setIndex(i)}
                // 44px of tappable area around a 6px mark.
                className="grid h-11 w-6 cursor-pointer place-items-center border-0 bg-transparent p-0"
              >
                <span
                  className={
                    index === i
                      ? 'block h-1.5 w-[18px] rounded-full bg-[var(--mr-gold-500)] lg:bg-[var(--mr-gold-300)]'
                      // ink-400 rather than ink-300: an inactive dot still has
                      // to be visible enough to aim at.
                      : 'block h-1.5 w-1.5 rounded-full bg-[var(--mr-ink-400)] lg:bg-[color-mix(in_oklab,var(--mr-cream-100)_70%,transparent)]'
                  }
                  style={{
                    transition: reduceMotion
                      ? 'none'
                      : 'width var(--mr-dur-medium) var(--mr-ease-out), background-color var(--mr-dur-medium)',
                  }}
                />
              </button>
            ))}
          </div>
          <span
            className="relative text-[var(--mr-fg-3)] lg:text-[var(--mr-cream-100)]"
            aria-hidden="true"
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.22em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {index + 1} / {total}
          </span>
        </div>
      )}
    </div>
  );
}

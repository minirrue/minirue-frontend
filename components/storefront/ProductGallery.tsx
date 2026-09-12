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
  /** Called on every slide change (dot, arrow, or swipe). Optional — analytics
   * is the only caller today, and it only needs to know the shopper engaged
   * with the gallery, not track every index change itself. */
  onOpen?: (index: number) => void;
}

/**
 * Every photograph on a product, in one carousel, at every width. Before this
 * a phone got a dotless swipe strip (nothing on screen said a second photo
 * existed) and a laptop got a stack of full-height slabs you had to scroll
 * past one by one.
 */
export default function ProductGallery({ product, items, onOpen }: ProductGalleryProps) {
  const [index, setIndex] = React.useState(0);
  const handleIndexChange = (i: number) => {
    setIndex(i);
    onOpen?.(i);
  };
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
        onIndexChange={handleIndexChange}
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
        /**
         * Floating over the bottom of the photograph, at EVERY size.
         *
         * It used to sit below the image on a phone and only become an overlay
         * at `lg:`. Below the image means on the cream page, full-bleed, between
         * the photograph and the one after it — which reads as a stray band
         * ruled across the middle of the page rather than as a control
         * belonging to the picture (owner, 2026-08-21: "prohibit this weird line
         * in middle, same as desktop better").
         *
         * An ink scrim rather than glass: the photograph underneath is unknown,
         * and this has to stay legible over every one of them.
         */
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center gap-4 rounded-full px-5 py-3 lg:bottom-8">
          <div
            className="absolute inset-0 rounded-full"
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
                onClick={() => handleIndexChange(i)}
                // 44px of tappable area around a 6px mark.
                className="grid h-11 w-6 cursor-pointer place-items-center border-0 bg-transparent p-0"
              >
                <span
                  className={
                    index === i
                      ? 'block h-1.5 w-[18px] rounded-full bg-[var(--mr-gold-300)]'
                      // 70% cream rather than a flat tint: an inactive dot
                      // still has to be visible enough to aim at against an
                      // unknown photograph.
                      : 'block h-1.5 w-1.5 rounded-full bg-[color-mix(in_oklab,var(--mr-cream-100)_70%,transparent)]'
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
            className="relative text-[var(--mr-cream-100)]"
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

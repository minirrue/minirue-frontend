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
 *
 * ## The slide's shape (#58)
 *
 * Each slide is a FIXED ratio at every width: 4:5 on a phone, 1:1 from `lg:`.
 * It used to be `lg:aspect-auto lg:h-screen` — no ratio at all on a laptop,
 * just "as tall as the window, as wide as this column". Two things followed
 * from that, and the owner reported both: the framing changed with every
 * window size (a 1440x900 laptop cropped the photograph differently from a
 * 1440x1200 one), and on a tall window the box grew past the source, so
 * `cover` upscaled it — "maximized… zoomed in… bad pixels".
 *
 * 1:1 rather than some other number, because that is what the DASHBOARD CROPS
 * TO. Gallery media arrives as an imgproxy `rs:fit:<w>:0:0` URL, which only
 * ever scales — it never crops — so what the storefront receives is exactly
 * the admin's crop, and every asset the pipeline serves today measures square
 * (901x901, 761x761, 1025x1025 across the live catalogue, checked 2026-09-12).
 * A square box therefore shows a square source WHOLE: with `objectFit: cover`,
 * nothing is cropped at all, which is the literal ask — stop cropping over the
 * dashboard's crop.
 *
 * `cover` is kept rather than `contain` for exactly that reason. On a square
 * source in a square box the two are pixel-identical, so `contain` would buy
 * nothing today; it would only start to differ on a non-square asset (the
 * legacy Cloudinary path), and there `cover` filling the frame beats `contain`
 * ruling cream letterbox bands across a full-bleed page.
 *
 * The phone's 4:5 is deliberately UNTOUCHED — the owner likes that framing,
 * and its box (390x487 at 390px wide) is small enough that `cover` downscales
 * rather than enlarges.
 *
 * What this does NOT fix: the source assets are only ~900px on the long edge,
 * so a DPR-2 laptop still asks for about twice the pixels that exist. That is
 * an upload-size problem (#11), not a layout one — the layout's job here is
 * only to stop making it worse, which a box that no longer grows with the
 * window height does.
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
            // Width only — never w AND h. `cloudinaryUrl()` emits no crop mode,
            // so `w_1400,h_1750` is Cloudinary's default `c_scale`: it does not
            // crop a square source into 4:5, it STRETCHES it. (Dead for gallery
            // media, whose `url` is already resolved by imgproxy and returned
            // as-is — live for the legacy Cloudinary-linked assets that still
            // fall through to it.) 1600 matches the `rs:fit:1600` the gallery
            // pipeline asks imgproxy for, so the two sources agree.
            const src = mediaImageUrl(m, { w: 1600 });
            if (!src) return null;
            return (
              <CarouselItem key={m.id} className="p-0">
                <div
                  data-trace-id={`PG-STOREFRONT-CAT-005::EL-IMG-product-carousel-image@${m.id}`}
                  className="relative aspect-[4/5] w-full lg:aspect-square"
                >
                  <Image
                    src={src}
                    alt={m.altText ?? product.name}
                    fill
                    priority={i === 0}
                    /*
                     * `priority` alone is not enough, and the difference is the
                     * whole of this change.
                     *
                     * `priority` emits the `<link rel=preload>` and switches off
                     * lazy loading — it decides WHEN the browser discovers the
                     * image. Verified in the live DOM: the preload is there and
                     * `loading` is correctly absent, but neither the link nor the
                     * `<img>` carries `fetchpriority`, so the request is
                     * discovered early and then queued at default priority.
                     *
                     * Discovery was never the problem. Decomposing the LCP
                     * request on production (Pixel 5, 4x CPU, Slow 4G, median of
                     * 3) puts the time here:
                     *
                     *     WAITING (proxy hop + origin work)    66 ms    4%
                     *     download                           1806 ms   96%
                     *
                     * and 78 KB at 1.6 Mbps is ~390ms, not 1806. The gap is
                     * contention: 21 other requests totalling 483 KB are on the
                     * wire during that window — roughly 6x the image's own weight
                     * in JavaScript and fonts. `fetchpriority` is the one thing
                     * that changes bandwidth SHARE under exactly that pressure,
                     * which a preload does not.
                     *
                     * Only the first slide. Marking several high is the same as
                     * marking none.
                     */
                    fetchPriority={i === 0 ? 'high' : undefined}
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

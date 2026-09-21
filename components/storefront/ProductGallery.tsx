'use client';

import React from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import StorefrontVideo from '@/components/storefront/StorefrontVideo';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { ApiProduct, MediaAsset } from '@/lib/api/catalog';
import { mediaImageUrl } from '@/lib/api/catalog';

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
 * ## Native scroll-snap, not a JS carousel (#7)
 *
 * This used to be `components/core/carousel.tsx`, a vendored motion-primitives
 * carousel driving slide position through `motion/react` — a drag gesture, a
 * `useMotionValue`, an `IntersectionObserver`, and a spring animating
 * `translateX`. It is now a `overflow-x: auto` strip with
 * `scroll-snap-type: x mandatory`, and the browser does all of that natively.
 *
 * The reason is bytes, and they were measured rather than assumed. Decomposing
 * the product page's LCP request on production (Pixel 5, 4x CPU, Slow 4G,
 * median of 3):
 *
 *     WAITING (proxy hop + origin work)    66 ms    4%
 *     download                           1806 ms   96%
 *
 * 78 KB at 1.6 Mbps is ~390ms, not 1806. The gap is contention — 21 other
 * requests totalling 483 KB are on the wire during that window. Every other
 * lever on #7 was tried and measured to nothing: format (~10% at matched
 * PSNR), the proxy hop (66ms total), earlier discovery (`fetchPriority`, 530ms
 * earlier, no LCP benefit), image bytes (already AVIF at 78 KB). What is left
 * is the JavaScript, and `motion` was ~56 KB of it.
 *
 * `next/dynamic` does not remove it — that was tried and measured too. With
 * `ssr: true` the chunk does split out of the entry (verified: it stops being
 * preloaded in the HTML) but React fetches it immediately to hydrate the
 * server-rendered markup, so it lands inside exactly the window that hurts.
 * Deleting the dependency is the only thing that actually removes the bytes.
 *
 * ## What changed for the shopper, honestly
 *
 * - **Touch swipe**: unchanged in feel, and now native momentum rather than a
 *   spring approximating it.
 * - **Mouse drag**: GONE. The old carousel let you grab a slide and drag it
 *   with a mouse. Native scrollers do not do that, and no shim was added,
 *   because the arrows already exist for exactly this case — they are rendered
 *   `[@media(pointer:fine)]` only, i.e. precisely when a mouse is what you
 *   have. A fine-pointer user keeps arrows, dots, the counter, and trackpad
 *   two-finger scroll.
 * - **Keyboard**: better, not worse. The strip is a real scroll container, so
 *   arrow keys and Page Up/Down work on focus, which the transform-based
 *   version did not support at all.
 *
 * ## The slide's shape (#58, revised #185)
 *
 * On a phone: a FIXED 4:5 ratio, `cover` — unchanged, and out of scope for
 * #185 (owner: "mobile unchanged").
 *
 * From `lg:`, the frame now takes the PHOTOGRAPH's OWN intrinsic aspect
 * ratio (`m.width`/`m.height` from the backend), capped at
 * `calc(100svh - header - gap)` — see `GALLERY_MAX_H_CSS` below. This used
 * to be a fixed 1:1 box with `object-fit: contain`: correct in that it never
 * cropped or upscaled, but on a short laptop window (1366x768, 1280x720) the
 * square box was taller than the space actually available, and the shopper
 * had to scroll the PAGE to see the rest of the photograph (owner, 2026-09-19:
 * "user can't scroll to see the rest height of the image" — in practice
 * meaning they shouldn't have to at all). It also meant a portrait photo
 * inside a square `contain` box always left visible letterbox bars on the
 * left and right, on every window size.
 *
 * Once the FRAME's own shape matches the image's shape exactly, `cover` and
 * `contain` render IDENTICALLY — there is nothing left to crop or letterbox
 * either way, so the `<Image>` below just uses `object-cover` unconditionally
 * now (no more `lg:object-contain` split). Any leftover space around a
 * height-capped frame (a landscape photo on a narrow column, or vice versa)
 * is the SAME `var(--mr-bg)` this component's own root already paints
 * (frontend#183) — invisible as a "gap" because it is the page's own colour,
 * not a visible bar.
 *
 * Deliberately CSS-only, no ResizeObserver/JS measurement: `width: auto;
 * height: auto; max-width: 100%; max-height: 100%;` on a box that also
 * carries `aspect-ratio` is browser-native "shrink to the largest size that
 * fits both constraints while keeping the ratio" — precisely `object-fit:
 * contain`'s own algorithm, just applied to the FRAME instead of the image
 * inside it. The per-slide OUTER box (the actual horizontal-scroll snap
 * unit `el.clientWidth` math above depends on) is left at its existing
 * `w-full` — only its HEIGHT is capped at `lg:`, and it centers the
 * (possibly narrower) frame within itself. Shrinking the slide's own width
 * to match each photo would have broken that scroll-position → index math,
 * which assumes uniform slide widths.
 *
 * The source URL is already imgproxy's highest useful WebP for this asset.
 * Sending it through `/_next/image` again made desktop Chrome choose a 21 KB
 * AVIF re-encode from a 67 KB WebP and visibly softened its label. The PDP
 * deliberately uses Next's scoped `unoptimized` escape hatch: no global image
 * policy changes, no invented upscale, and every available source pixel reaches
 * this high-attention product view. (The request width itself is still the
 * flat 1600px asked for below — deliberately NOT resized to the capped
 * display size × devicePixelRatio for this pass: that would need a
 * client-only measurement recomputed after mount, which risks delaying the
 * very LCP request this file's own history above spent real effort
 * protecting. 1600px WebP already covers the capped display size at 2x DPR
 * on every desktop viewport tested (1440x900, 1366x768, 1280x720), so
 * nothing is visibly softened in practice; a true responsive `srcSet` is
 * left as a follow-up if a wider viewport ever needs it.)
 */
/**
 * frontend#185 — desktop's own copy column's chrome, measured once against
 * the live header (`components/layout/Header.tsx`, `position: sticky`) at
 * rest: read live from the `--mr-header-h` token, which the site header
 * publishes in mr-tokens.css. (Written without an angle-bracketed component
 * name on purpose: __tests__/storefront/chrome-coverage.test.ts greps the
 * source for that pattern and would count this comment as a real usage.)
 *
 * This WAS a hardcoded `89` justified by "no scroll-shrink observed on the
 * product page in testing". That observation was wrong. Measured on
 * production: the header is 89px at the top and 73px once scrolled, because
 * `.mr-header-inner` swaps its vertical padding from 22px to 14px on
 * `scrolled`. A constant of 89 is therefore 16px too tall for every scrolled
 * state, and the gallery was sized against a header height that stops being
 * true the moment the visitor moves. The variable has a fallback so the rule
 * stays pure CSS — still no ResizeObserver, still no client recompute.
 *
 * The old `GALLERY_GAP_PX = 24` is gone. It was described as "breathing room
 * below the header", but it sat BELOW the frame, so all it did was end the
 * gallery 24px short of the fold and let the dark description section behind
 * it show through as a black strip at the bottom of the first screen (owner,
 * 2026-09-21: "the black strip is just the description under it… I want it
 * visible after the 1px scroll, not at 0px"). Filling the space exactly is
 * what makes the description start precisely at the fold.
 */
/** `lg:` viewport cap for the gallery frame — the whole photograph must fit
 *  without scrolling (frontend#185). Mobile is untouched: this value is only
 *  ever read by the `@media (min-width: 1024px)` rule below. */
const GALLERY_MAX_H_CSS = 'calc(100svh - var(--mr-header-h, 89px))';

export default function ProductGallery({ product, items, onOpen }: ProductGalleryProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const reduceMotion = usePrefersReducedMotion();

  const total = items.length;
  const single = total <= 1;

  /*
   * Where a programmatic scroll is heading, while it is still travelling.
   *
   * A dot press sets `index` immediately — the control has to answer the press,
   * not wait out a ~400ms smooth scroll, and on a browser or environment where
   * `scrollTo` does not animate at all it is the only update that happens. But
   * a smooth scroll from photo 1 to photo 3 PASSES OVER photo 2, and the scroll
   * handler below would faithfully report it, flashing the counter 1 → 2 → 3
   * for one press. So while a programmatic scroll is in flight, scroll-derived
   * updates are ignored until the destination is reached.
   *
   * The timeout is the safety net: if the shopper grabs the strip mid-flight
   * the destination is never reached, and without it the counter would be stuck
   * following a scroll that is no longer happening.
   */
  const pending = React.useRef<number | null>(null);
  const pendingTimer = React.useRef<number | undefined>(undefined);

  /*
   * Otherwise the scroll position IS the state. Reading the index back off the
   * scroller rather than tracking it separately is what makes a swipe, an arrow
   * and a dot all converge on one answer — the old carousel had drag write one
   * path and `setIndex` write another, and the two could disagree mid-gesture.
   *
   * rAF-throttled because scroll fires far faster than paint, and passive so it
   * can never delay the scroll it is observing.
   */
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const width = el.clientWidth;
        if (!width) return;
        const next = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / width)));

        if (pending.current !== null) {
          if (next !== pending.current) return; // still travelling
          pending.current = null; // arrived
        }
        setIndex((prev) => (prev === next ? prev : next));
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [total]);

  React.useEffect(
    () => () => {
      if (pendingTimer.current !== undefined) window.clearTimeout(pendingTimer.current);
    },
    [],
  );

  /*
   * Analytics wants "the shopper engaged with the gallery", not the initial
   * render, so this deliberately does not fire for the landing index.
   */
  const reported = React.useRef(0);
  React.useEffect(() => {
    if (index === reported.current) return;
    reported.current = index;
    onOpen?.(index);
  }, [index, onOpen]);

  const goTo = React.useCallback(
    (i: number) => {
      const el = scrollerRef.current;
      if (!el) return;

      // Answer the press now; let the scroller correct it on arrival.
      pending.current = i;
      setIndex(i);
      if (pendingTimer.current !== undefined) window.clearTimeout(pendingTimer.current);
      pendingTimer.current = window.setTimeout(() => {
        pending.current = null;
      }, 700);

      const left = i * el.clientWidth;

      /*
       * `Element.scrollTo` with an options object is not universal — Safari
       * only got it in 14, and jsdom does not implement it at all. Calling it
       * unguarded throws inside the click handler, which takes the dots out
       * entirely rather than degrading. Assigning `scrollLeft` is the fallback:
       * it jumps instead of gliding, which is the correct trade for a browser
       * that cannot glide.
       */
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({
          left,
          // `smooth` is the house feel; instant for anyone who asked for less
          // movement. This is the one place reduced motion has to be honoured
          // in JS — `scroll-behavior` in CSS would be capped by the tokens
          // file, but a programmatic scroll names its own behaviour and
          // overrides it.
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      } else {
        el.scrollLeft = left;
      }
    },
    [reduceMotion],
  );

  return (
    <div
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-carousel"
      className="group/hover relative"
      // The site's own background (frontend#183), not the sunken/gray
      // `--mr-cream-300` tile fill, plus the same small radius + clip
      // ProductCard's image tile uses elsewhere in the catalogue — the
      // product photograph gets the same rounded, on-background frame as
      // every other product image on the storefront.
      style={{
        background: 'var(--mr-bg)',
        borderRadius: 'var(--mr-radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Scoped to this component's own class so it cannot reach any other
          scroller on the page. Firefox and IE take the properties above; this
          is the WebKit/Blink half, which has no property form.

          The `lg:` rules below are frontend#185's viewport-fit sizing (see
          the file-header comment). They live in a scoped `<style>`, not
          inline `style` props, because the shape they set depends on a
          BREAKPOINT (`min-width: 1024px`) and inline styles cannot carry
          one — mobile keeps its own separate Tailwind classes
          (`aspect-[4/5] w-full`) on the same elements, applied at every
          width, which these rules only override from `lg:` up. The actual
          NUMBERS (the cap height, each photo's own aspect ratio) are still
          set per-element via CSS custom properties in the inline `style`
          below — only the properties that READ those variables live here. */}
      <style>{`
        .mr-gallery-strip::-webkit-scrollbar{display:none}
        /* Every width, phone included: the frame takes the PHOTOGRAPH's own
           ratio. This used to be a hardcoded aspect-[4/5] utility on mobile,
           which cropped any photograph that was not exactly 4:5 — measured on
           production at 390px: frame 0.799 vs image 0.824, ~3% of the picture
           shaved off. The owner's rule is that only the dashboard's own
           cropper may crop; the storefront shows 100% of what was uploaded.
           (No backticks anywhere in this block — frontend#97: a backtick in a
           CSS comment ends the template literal.) */
        .mr-gallery-frame {
          width: 100%;
          aspect-ratio: var(--mr-gallery-ar, 0.8);
          /* "Maximized" means filling the first screen, NOT spilling past it
             (owner, 2026-09-21). A portrait photograph at 100% width can be
             taller than the viewport — e.g. a 0.5-ratio shot at 390px wide is
             780px tall, which with the header exceeds an 844px phone — and
             the visitor then has to scroll to see the product at all. Capping
             here scales it down to fit; object-fit contain keeps it uncropped
             and the backdrop fills the sides. Applies at every width, phones
             included. */
          max-height: calc(
            100svh - var(--mr-header-h, 89px) - var(--mr-pdp-lead, 0px)
          );
        }
        @media (min-width: 1024px) {
          .mr-gallery-slide {
            display: flex;
            align-items: center;
            justify-content: center;
            height: var(--mr-gallery-cap-h);
          }
          /* The frame now FILLS the column instead of being letterboxed
             inside it. The column itself is sized to the photograph's own
             ratio (see ApiProductDetail's media column), so this box is
             already the right shape — and where the stored ratio is missing
             or wrong, the backdrop below absorbs the difference instead of
             printing cream bars. */
          .mr-gallery-frame {
            height: 100%;
            width: 100%;
            aspect-ratio: auto;
            /* The desktop slide is already capped by --mr-gallery-cap-h on
               the slide itself, and nothing sits above the photographs in
               this column, so the phone/tablet lead does not apply here. */
            max-height: none;
          }
        }
        /* NEVER crop (owner, 2026-09-21: "prevent any crop on the image, all
           is viewed however resized on any device keeping same aspect
           ratio"). Contain guarantees the whole photograph is visible even
           when the media row carries no width/height and the ratio falls
           back — which is the case in production today. */
        .mr-gallery-frame > img {
          object-fit: contain;
        }
        /* What fills the space contain leaves. A blurred, over-scaled copy
           of the same photograph, so the backdrop is derived from the image
           itself rather than a hardcoded cream that shows every edge. Kept
           out of the a11y tree and off the pointer. */
        .mr-gallery-backdrop {
          position: absolute;
          inset: 0;
          z-index: 0;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
          filter: blur(44px) saturate(1.1);
          transform: scale(1.12);
          pointer-events: none;
        }
        /* z-index only — never position. next/image's fill mode sets
           position:absolute with inset:0 itself, and overriding it collapses
           the image out of the frame. */
        .mr-gallery-frame > img {
          z-index: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .mr-gallery-backdrop { filter: blur(44px); }
        }
      `}</style>

      <div
        ref={scrollerRef}
        className="mr-gallery-strip flex w-full overflow-x-auto"
        style={{
          // One photograph is not a carousel: no snapping, and nothing to swipe
          // between.
          scrollSnapType: single ? 'none' : 'x mandatory',
          // A swipe past the last photograph must not turn into the browser's
          // back-navigation gesture or bounce the page behind it.
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {items.map((m, i) => {
          // Width only — never w AND h. `cloudinaryUrl()` emits no crop mode,
          // so `w_1400,h_1750` is Cloudinary's default `c_scale`: it does not
          // crop a square source into 4:5, it STRETCHES it. (Dead for gallery
          // media, whose `url` is already resolved by imgproxy and returned
          // as-is — live for the legacy Cloudinary-linked assets that still
          // fall through to it.) 1600 matches the `rs:fit:1600` the gallery
          // pipeline asks imgproxy for, so the two sources agree.
          const readyVideo = m.kind === 'video' && (m.status ?? 'ready') === 'ready';
          // A converting/failed video's `url` is intentionally its poster on
          // the backend. Never hand that still image to a video element.
          const src = readyVideo
            ? m.url ?? ''
            : m.kind === 'video'
              ? m.posterUrl ?? m.url ?? ''
              : mediaImageUrl(m, { w: 1600 });
          if (!src) return null;
          // The photograph's own shape, from the backend's stored intrinsic
          // dimensions — never measured client-side.
          //
          // The fallback is NOT pathological, whatever the previous comment
          // here claimed ("never seen live"). `gallery_items.width/height`
          // are nullable, nothing backfills them, and `exchangeItem` nulls
          // them whenever its caller supplies no dimensions — so rows with no
          // ratio are in production right now. This very product is one: the
          // live frame computes 4/5 = 0.800 for a photograph that is 989x1200
          // = 0.824. `contain` is what keeps that harmless; the number below
          // is what makes it exact when the data is there.
          //
          // A NUMBER, not an `a / b` string, because the media column sizes
          // itself with `calc(var(--mr-gallery-ar) * ...)` and calc cannot
          // multiply by a ratio.
          const ar = m.width && m.height ? m.width / m.height : 0.8;
          return (
            <div
              key={m.id}
              className="mr-gallery-slide w-full min-w-0 shrink-0 grow-0"
              style={{
                scrollSnapAlign: 'center',
                scrollSnapStop: 'always',
                ['--mr-gallery-cap-h' as string]: GALLERY_MAX_H_CSS,
              }}
            >
              <div
                data-trace-id={`PG-STOREFRONT-CAT-005::EL-IMG-product-carousel-image@${m.id}`}
                className="mr-gallery-frame relative w-full"
                style={{ ['--mr-gallery-ar' as string]: ar }}
              >
                {/* The backdrop that makes `contain` look deliberate: a
                    blurred, over-scaled copy of this same photograph filling
                    whatever space the contained image does not. Derived from
                    the image itself (owner: "make the background of the image
                    on html itself dynamic so the user doesn't feel it's
                    cropped"), so a white-background product shot no longer
                    prints a hard white rectangle on the cream page. Images
                    only — a video already paints its own frame. */}
                {!readyVideo && m.kind !== 'video' && (
                  <div
                    aria-hidden="true"
                    className="mr-gallery-backdrop"
                    style={{ backgroundImage: `url(${src})` }}
                  />
                )}
                {readyVideo ? (
                  <StorefrontVideo
                    src={src}
                    poster={m.posterUrl}
                    label={m.altText ?? `${product.name} video`}
                    active={i === index}
                  />
                ) : (
                  <Image
                    src={src}
                    alt={m.altText ?? product.name}
                    fill
                    unoptimized
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
                  // `contain`, never `cover`. The old comment here said the
                  // frame "already takes the photograph's own aspect ratio,
                  // so cover and contain resolve to the exact same box" —
                  // true only when the media row HAS width/height. When it
                  // does not (production, today) the frame falls back to a
                  // ratio that is not the photograph's and `cover` silently
                  // crops to it. `contain` cannot crop under any ratio, and
                  // the blurred backdrop above fills what it leaves.
                  className="object-contain"
                  // Dragging an image drags the browser's own ghost preview
                  // instead of the strip.
                    draggable={false}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!single && (
        /*
         * Fine pointers only — on a phone the swipe is the control, and arrows
         * would sit on top of the photograph for no reason. This is also what
         * makes losing mouse-drag acceptable: the pointer type that lost the
         * gesture is exactly the one these are rendered for.
         */
        <div className="pointer-events-none absolute left-0 top-1/2 hidden w-full -translate-y-1/2 justify-between px-4 [@media(pointer:fine)]:flex">
          <button
            type="button"
            aria-label="Previous slide"
            className="pointer-events-auto h-fit w-fit rounded-full bg-[rgba(11,11,11,0.45)] p-3 text-[var(--mr-cream-100)] opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-[rgba(11,11,11,0.65)] group-hover/hover:opacity-100 group-hover/hover:disabled:opacity-40"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            className="pointer-events-auto h-fit w-fit rounded-full bg-[rgba(11,11,11,0.45)] p-3 text-[var(--mr-cream-100)] opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-[rgba(11,11,11,0.65)] group-hover/hover:opacity-100 group-hover/hover:disabled:opacity-40"
            disabled={index + 1 === total}
            onClick={() => goTo(index + 1)}
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}

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
                aria-label={`Go to media ${i + 1} of ${total}`}
                aria-current={index === i}
                onClick={() => goTo(i)}
                // 44px of tappable area around a 6px mark.
                className="grid h-11 w-6 cursor-pointer place-items-center border-0 bg-transparent p-0"
              >
                <span
                  className={
                    index === i
                      ? 'block h-1.5 w-[18px] rounded-full bg-[var(--mr-gold-300)]'
                      : // 70% cream rather than a flat tint: an inactive dot
                        // still has to be visible enough to aim at against an
                        // unknown photograph.
                        'block h-1.5 w-1.5 rounded-full bg-[color-mix(in_oklab,var(--mr-cream-100)_70%,transparent)]'
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

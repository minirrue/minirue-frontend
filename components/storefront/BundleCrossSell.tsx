'use client';

import React from 'react';
import Link from 'next/link';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';
import Icon from '@/components/ui/Icon';
import type { Bundle } from '@/lib/api/bundles';
import type { BundleIndex } from '@/components/storefront/cart/bag-lines';
import { useBundleIndex } from '@/components/storefront/cart/use-bundle-catalog';

/**
 * "Also part of these sets" — the sets a product on screen belongs to.
 *
 * ## Where the membership comes from (no backend change, and none needed)
 *
 * `GET /v1/bundles` already returns every public set WITH its contents:
 * `Bundle.members[]` carries `productId`, `productSlug` and `categorySlug`
 * (`lib/api/bundles.ts`). "Which sets contain this product" is therefore a
 * filter over a list the shop already publishes — one request, client-side,
 * no new endpoint and, crucially, **no new field on the product payload**.
 *
 * That last point is the whole reason this reads the bundle index rather than
 * the product. `catalog.getProductBySlug` is served from a server-side cache
 * (see the `imageSrcSet` note in `lib/api/storefront.ts`): a field added there
 * is only as fresh as the cache, so a set built or retired in the dashboard
 * would keep showing — or keep not showing — on every product page until the
 * entry turned over. The bundle index has no such lag; it is the same list the
 * bag looks names up in, and it is re-read per page load.
 *
 * The fetch is the ONE that `components/storefront/cart/use-bundle-catalog.ts`
 * already makes — same module-level promise, so a shopper who also opens the
 * bag on this page pays for it once, not twice.
 *
 * ## Why it is not fetched until the shopper scrolls
 *
 * This page's LCP is image-bound and already slow (#7: the carousel photograph
 * at ~3.7s). A cross-sell that fires a request and starts decoding set photos
 * while that image is still in flight makes the number the owner complained
 * about worse. So:
 *
 *  - Nothing is fetched on mount. `useBundleIndex(enabled)` is gated on a
 *    sentinel coming within 600px of the viewport, which on this page means
 *    the shopper has scrolled past the gallery, the editorial block and the
 *    reviews. Most product pages therefore make no request at all.
 *  - Nothing renders on the server, so not one of these photographs is in the
 *    initial HTML and none of them can be an LCP candidate. (The LCP element
 *    is picked from what paints; these `<img>`s do not exist yet.)
 *  - Every card image is `next/image` without `priority`, i.e. `loading="lazy"`
 *    in the DOM, so even after they mount they are not fetched until they are
 *    near the viewport and are ineligible as LCP candidates in every engine
 *    that honours the attribute.
 *
 * ## Hide when empty
 *
 * Most products are in no set. This renders a zero-height sentinel and
 * nothing else — no heading, no rule, no padding. The section only exists once
 * there is at least one set to put in it.
 */

/**
 * How many sets one product page will show.
 *
 * Every card is another photograph on a page that is already image-bound, so
 * this is a byte budget as much as a layout one. Six is about a screen and a
 * half of the rail at 1440px: enough that no realistic catalogue is truncated
 * (the shop has three sets in total today), and past that the shopper is
 * browsing the set catalogue rather than cross-shopping this product — which
 * is what the "All sets" card at the end of a truncated rail is for.
 */
export const MAX_SETS = 6;

/**
 * The sets that contain `productId`, in the order they should be shown.
 *
 * Pure and exported so the rule is testable without a network or a DOM.
 *
 * Order:
 *  1. **Buyable first.** A set that cannot be added to a bag must not outrank
 *     one that can — the shopper's next tap has to lead somewhere.
 *  2. **Biggest saving first** within each group. The saving is the reason
 *     this section exists; the strongest offer leads.
 *  3. Then cheapest, then name — so the order is total and deterministic
 *     rather than dependent on whatever order the API happened to answer in.
 *
 * Out-of-stock sets are KEPT, not filtered. That is the rule the bundle pages
 * already follow: `/bundles` lists them and `/bundles/[slug]` renders the
 * whole page with its button disabled and reading "Currently unavailable"
 * (`app/bundles/[slug]/BundleDetail.tsx`). Hiding them here would be a second,
 * contradicting rule — a set visible in one place and absent in another — so
 * the card carries the same label instead.
 */
export function bundlesForProduct(
  index: BundleIndex,
  productId: string,
  cap: number = MAX_SETS,
): Bundle[] {
  if (!productId) return [];
  const matches: Bundle[] = [];
  for (const bundle of index.values()) {
    if (bundle.members?.some((m) => m.productId === productId)) {
      matches.push(bundle);
    }
  }
  matches.sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    if (b.savingMinor !== a.savingMinor) return b.savingMinor - a.savingMinor;
    if (a.priceMinor !== b.priceMinor) return a.priceMinor - b.priceMinor;
    return a.name.localeCompare(b.name);
  });
  return matches.slice(0, cap);
}

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** One card in the rail. */
const SetCard = React.memo(function SetCard({ bundle }: { bundle: Bundle }) {
  return (
    <li
      style={{
        // A card is never wider than 260px at any viewport, which is what makes
        // `sizes="260px"` below an honest upper bound. At 390px it is 242px, so
        // the next card's edge is always visible — the rail says it scrolls
        // without needing a caption that says so.
        flex: '0 0 clamp(200px, 62vw, 260px)',
        scrollSnapAlign: 'start',
        minWidth: 0,
      }}
    >
      <Link
        data-trace-id={`PG-STOREFRONT-CAT-005::EL-LINK-bundle-cross-sell@${bundle.slug}`}
        href={`/bundles/${bundle.slug}`}
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      >
        <div
          style={{
            aspectRatio: '1 / 1',
            background: 'var(--mr-cream-300)',
            borderRadius: 6,
            overflow: 'hidden',
            marginBottom: 'var(--mr-sp-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // `fill` below is absolutely positioned and needs a positioned
            // ancestor, as any `next/image fill` does.
            position: 'relative',
          }}
        >
          {bundle.imageUrl ? (
            // Never a bare <img>: a set photo replaced in the dashboard lands
            // on a new uuid-suffixed key whose first request is a guaranteed
            // cold miss, and one transient failure would leave this card broken
            // for every shopper (see UploadPreviewImage). It renders through
            // `next/image` with no `priority`, i.e. `loading="lazy"`.
            <UploadPreviewImage
              src={bundle.imageUrl}
              alt=""
              fill
              sizes="260px"
            />
          ) : (
            <Icon name="grid" size={24} color="var(--mr-fg-4)" />
          )}
        </div>

        <h3
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontWeight: 400,
            fontSize: 'var(--mr-text-base)',
            lineHeight: 1.25,
            margin: '0 0 var(--mr-sp-1)',
          }}
        >
          {bundle.name}
        </h3>

        <p
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-sm)',
            color: 'var(--mr-fg-2)',
            margin: 0,
          }}
        >
          {minorToAmount(bundle.priceMinor)} {bundle.currency}
        </p>

        {bundle.savingMinor > 0 && (
          // Word for word what the set's own page says, so the promise a
          // shopper reads here is the promise they land on.
          <p
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              lineHeight: 1.45,
              color: 'var(--mr-fg-4)',
              margin: 'var(--mr-sp-1) 0 0',
            }}
          >
            Instead of {minorToAmount(bundle.listTotalMinor)} {bundle.currency} bought
            separately — you save {minorToAmount(bundle.savingMinor)} {bundle.currency}.
          </p>
        )}

        {!bundle.inStock && (
          <p
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-4)',
              margin: 'var(--mr-sp-2) 0 0',
            }}
          >
            Currently unavailable
          </p>
        )}
      </Link>
    </li>
  );
});

/**
 * The rendered section. Separated from the data above so the markup can be
 * tested without a network, an IntersectionObserver or a cart provider.
 */
export function BundleCrossSellSection({
  bundles,
  truncated = false,
}: {
  bundles: Bundle[];
  /** True when more sets exist than the rail is showing — adds the "All sets" card. */
  truncated?: boolean;
}) {
  const railRef = React.useRef<HTMLUListElement | null>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(true);

  // Arrow state. A phone scrolls this rail with a thumb and needs no arrows;
  // a mouse has no horizontal gesture at all, so the desktop arrows are the
  // only affordance there. They disable at the ends rather than disappearing,
  // so the row does not change width as it scrolls.
  const syncArrows = React.useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // 1px of slack: sub-pixel layout leaves scrollLeft a hair short of max.
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  React.useEffect(() => {
    syncArrows();
  }, [syncArrows, bundles]);

  function scrollByCards(direction: 1 | -1) {
    const el = railRef.current;
    if (!el) return;
    // One viewport of the rail, less a card's worth of overlap so the card that
    // was half-visible at the edge is fully on screen afterwards.
    const step = Math.max(el.clientWidth - 80, 160);
    // jsdom implements neither smooth scrolling nor `scrollBy` — the arrows are
    // a pointer affordance, so a missing method is not worth a crash.
    el.scrollBy?.({ left: direction * step, behavior: 'smooth' });
  }

  if (bundles.length === 0) return null;

  return (
    <section
      data-testid="bundle-cross-sell"
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-bundle-cross-sell"
      aria-labelledby="bundle-cross-sell-heading"
      style={{
        borderTop: '1px solid var(--mr-hairline)',
        padding: 'clamp(40px,7vw,64px) 0 clamp(40px,7vw,64px)',
        background: 'var(--mr-cream-200)',
        // Belt and braces with the `lg:min-w-0` on this column's wrapper: a
        // scroll container must never be allowed to widen its own ancestors,
        // or the rail stops scrolling and runs off the side of the window
        // instead.
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--mr-sp-4)',
          // Matches the rail's own inline padding below, so the heading and the
          // first card start on the same vertical line.
          padding: '0 clamp(20px,5vw,32px)',
          marginBottom: 'var(--mr-sp-5)',
        }}
      >
        <h2
          id="bundle-cross-sell-heading"
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(var(--mr-text-lg), 2.4vw, var(--mr-text-2xl))',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          Also part of these sets
        </h2>

        <div className="hidden lg:flex" style={{ gap: 8, flex: '0 0 auto' }}>
          <button
            type="button"
            aria-label="Previous sets"
            aria-controls="bundle-cross-sell-rail"
            onClick={() => scrollByCards(-1)}
            disabled={atStart}
            className="mr-nav-link"
            style={arrowStyle(atStart)}
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            type="button"
            aria-label="More sets"
            aria-controls="bundle-cross-sell-rail"
            onClick={() => scrollByCards(1)}
            disabled={atEnd}
            className="mr-nav-link"
            style={arrowStyle(atEnd)}
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>

      <ul
        id="bundle-cross-sell-rail"
        ref={railRef}
        onScroll={syncArrows}
        className="scrollbar-hide"
        style={{
          listStyle: 'none',
          margin: 0,
          display: 'flex',
          gap: 'var(--mr-sp-4)',
          overflowX: 'auto',
          // Snap so the rail never rests mid-card, and pad the scroll start so
          // a snapped card clears the gutter rather than kissing the edge —
          // the same shape as the account nav scroller.
          scrollSnapType: 'x proximity',
          scrollPaddingLeft: 'clamp(20px,5vw,32px)',
          // Browsers reliably honour a scroller's LEADING inline padding and
          // drop the trailing one, so the trailing spacer after the list — not
          // this padding — is what actually holds the gap at the right edge.
          padding: '0 0 0 clamp(20px,5vw,32px)',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
      >
        {bundles.map((b) => (
          <SetCard key={b.id} bundle={b} />
        ))}

        {truncated && (
          <li style={{ flex: '0 0 clamp(200px, 62vw, 260px)', scrollSnapAlign: 'start' }}>
            <Link
              data-trace-id="PG-STOREFRONT-CAT-005::EL-LINK-bundle-cross-sell-all"
              href="/bundles"
              style={{
                display: 'flex',
                aspectRatio: '1 / 1',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: '1px solid var(--mr-hairline)',
                borderRadius: 6,
                textDecoration: 'none',
                color: 'var(--mr-fg-2)',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              All sets <Icon name="chevronRight" size={14} />
            </Link>
          </li>
        )}

        {/* Holds the right-hand gutter: see the padding note above. */}
        <li aria-hidden="true" style={{ flex: '0 0 clamp(20px,5vw,32px)' }} />
      </ul>
    </section>
  );
}

function arrowStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'none',
    border: '1px solid var(--mr-hairline)',
    borderRadius: '50%',
    width: 34,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--mr-ink-900)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    transition: 'opacity var(--mr-dur-normal) var(--mr-ease-out)',
  };
}

/**
 * How far ahead of the viewport the sets are fetched.
 *
 * Far enough that the rail is populated by the time it is scrolled to, late
 * enough that a shopper who never reaches the bottom of the page — which is
 * most of them, and all of the ones whose LCP we are protecting — never makes
 * the request at all.
 */
const PREFETCH_MARGIN = '600px';

export default function BundleCrossSell({ productId }: { productId: string }) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [near, setNear] = React.useState(false);

  React.useEffect(() => {
    if (near) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // No observer at all (a very old browser) — there is no way to know when
      // the rail is approached, so fetch rather than hide the section forever.
      setNear(true);
      return;
    }

    let reported = false;
    const io = new IntersectionObserver(
      (entries) => {
        reported = true;
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: `${PREFETCH_MARGIN} 0px` },
    );
    io.observe(el);

    // Same safety as the sticky buy bar above this component's call site: if
    // the observer never reports AT ALL, fall back to fetching. A report that
    // says "not near" is a report, so this does not fire for the common case
    // of a shopper who simply has not scrolled.
    const safety = setTimeout(() => {
      if (!reported) setNear(true);
    }, 3000);

    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, [near]);

  // The bag's own read, not a second fetcher — one module-level promise per
  // page load, shared with the cart drawer.
  const index = useBundleIndex(near);

  const all = React.useMemo(
    () => bundlesForProduct(index, productId, Number.POSITIVE_INFINITY),
    [index, productId],
  );
  const shown = all.slice(0, MAX_SETS);

  return (
    <>
      {/* Zero-height and empty: a product in no set leaves nothing behind — no
          heading, no rule, no padding. */}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 0 }} />
      <BundleCrossSellSection bundles={shown} truncated={all.length > shown.length} />
    </>
  );
}

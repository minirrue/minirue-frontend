'use client';

import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import type { ApiProduct, ProductVariant } from '@/lib/api/catalog';
import {
  carouselMedia,
  closingMedia,
  mediaImageUrl,
  productBrand,
  productByline,
  variantLabel, variantInStock } from '@/lib/api/catalog';
import WishlistHeart from './WishlistHeart';
import VariantPicker from './VariantPicker';
import PriceDisplay, { formatPrice } from './PriceDisplay';
import { useDiscountedPrice } from '@/lib/hooks/use-sitewide-discount';
import Icon from '@/components/ui/Icon';
import Sparkle from '@/components/ui/Sparkle';
import type { ProductSectionConfig } from '@/lib/api/storefront';
import ShareButton from './ShareButton';
import WordReveal from '@/components/ui/WordReveal';
import { useEnterSpring, useCrossfade } from '@/lib/motion/hooks';
import { track } from '@/lib/analytics';
import { subtotalToMinor } from '@/lib/checkout/checkout-schemas';

/**
 * Split out on purpose. The carousel is the only thing on the shop that pulls
 * in `motion` (~56KB gzipped with the primitive), and folding that into the
 * product route's first load pushed it past the 250KB budget. Still rendered on
 * the server — the first photograph is the page's largest paint and has to be
 * in the HTML — but its JavaScript arrives as its own chunk.
 */
const ProductGallery = dynamic(() => import('./ProductGallery'));

/**
 * Split for the same reason as the gallery: reviews sit below the editorial
 * moment, and they carry two sheets, a star picker and an upload form that
 * most shoppers never open. Folding all of it into the product route's first
 * load pushed the route past the 250KB ceiling on its own. Still rendered on
 * the server, so the star summary is in the HTML for anyone who scrolls
 * straight to it.
 */
const ProductReviews = dynamic(() => import('./reviews/ProductReviews'));

interface ApiProductDetailProps {
  product: ApiProduct;
  /** Service promises from Storefront -> Product section. */
  perks?: ProductSectionConfig['perks'];
  onBack: () => void;
  /** `source` tells the caller which of the two buy buttons on this page was
   * pressed — the main CTA in the copy column, or the phone-only sticky bar. */
  onAddToBag: (variant: ProductVariant, source: 'pdp' | 'sticky') => void;
}

/* ────────────────────────────────────────────────────────────────────────────
   Every piece of the page below is declared at MODULE level, on purpose.
   Declared inside the parent's body they would be a new component *type* on
   every render, and React unmounts a subtree whose type changed. Each remount
   restarts the CSS entrance keyframes, which is why tapping the heart used to
   replay the whole copy block. Keep them out here.
   ──────────────────────────────────────────────────────────────────────────── */

const ProductBackButton = React.memo(function ProductBackButton({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <button
      data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-back-to-all-perfumes"
      onClick={onBack}
      style={{
        background: 'none',
        border: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        gap: 8,
        alignItems: 'center',
        fontFamily: 'var(--mr-font-label)',
        fontSize: 'var(--mr-text-xs)',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--mr-fg-3)',
        padding: 0,
        transition: 'color var(--mr-dur-fast)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mr-fg)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mr-fg-3)')}
    >
      <Icon name="arrowLeft" size={13} /> All perfumes
    </button>
  );
});

interface ProductInfoPanelProps {
  product: ApiProduct;
  perks: ProductSectionConfig['perks'];
  activeVariants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelectVariant: (v: ProductVariant) => void;
  added: boolean;
  addedAnim: boolean;
  soldOut: boolean;
  allSoldOut: boolean;
  onAdd: () => void;
  ctaStyle: React.CSSProperties;
  ctaDisplay: string;
  /** Watched by the sticky buy bar's IntersectionObserver — see W3.4. */
  addToBagRef: React.RefObject<HTMLButtonElement | null>;
}

const ProductInfoPanel = React.memo(function ProductInfoPanel({
  product,
  perks,
  activeVariants,
  selectedVariant,
  onSelectVariant,
  added,
  addedAnim,
  soldOut,
  allSoldOut,
  onAdd,
  ctaStyle,
  ctaDisplay,
  addToBagRef,
}: ProductInfoPanelProps) {
  /**
   * The price under the running sitewide markdown, or the plain price when
   * none is running. Computed once and used by BOTH the main price and the
   * sticky buy bar below — those two showing different numbers on one screen
   * is the kind of thing a shopper screenshots.
   */
  const shownPrice = useDiscountedPrice(
    selectedVariant?.priceAmount ?? '0',
    !product.collaboratorId,
  );

  return (
    <div
      data-testid="product-info-panel"
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-info-panel"
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          // fg-4 (#8A8376) on cream fails 4.5:1 at this size; fg-3 clears it.
          color: 'var(--mr-fg-3)',
          marginBottom: 16,
          animation: 'mr-word-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '100ms',
        }}
      >
        {productByline(product) || product.categoryName}
      </div>

      <h1
        data-testid="product-title"
        style={{
          fontFamily: 'var(--mr-font-serif)',
          fontWeight: 400,
          fontSize: 'clamp(38px, 3.8vw, 56px)',
          lineHeight: 1.0,
          letterSpacing: '-0.015em',
          textWrap: 'balance',
          margin: '0 0 20px',
          color: 'var(--mr-fg)',
          animation: 'mr-word-in 0.6s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '160ms',
        }}
      >
        <WordReveal text={product.name} delay={200} wordDelay={80} />
      </h1>

      {/* Price */}
      {selectedVariant && (
        <div
          data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-selected-variant-price"
          style={{
            marginBottom: 24,
            animation: 'mr-word-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '300ms',
          }}
        >
          <span style={ctaStyle}>
            <PriceDisplay
              amount={shownPrice.amount}
              wasAmount={shownPrice.wasAmount}
              currency={selectedVariant.priceCurrency}
              style={{ fontSize: 'var(--mr-text-xl)' }}
            />
          </span>
        </div>
      )}

      {/* Tagline */}
      {product.tagline && (
        <p
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontStyle: 'italic',
            fontSize: 18,
            lineHeight: 1.5,
            textWrap: 'pretty',
            color: 'var(--mr-fg-2)',
            margin: '0 0 36px',
            animation: 'mr-word-in 0.6s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '380ms',
          }}
        >
          {product.tagline}
        </p>
      )}

      {/* Variant picker */}
      {activeVariants.length > 0 && (
        <div
          data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-variant-picker"
          style={{
            marginBottom: 28,
            animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '440ms',
          }}
        >
          <VariantPicker
            variants={activeVariants}
            selectedId={selectedVariant?.id ?? null}
            onChange={onSelectVariant}
            traceIdPrefix="PG-STOREFRONT-CAT-005::EL-TOGGLE-variant-option"
          />
        </div>
      )}

      {/* CTA row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 36,
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '500ms',
        }}
      >
        <button
          ref={addToBagRef}
          data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag"
          onClick={onAdd}
          disabled={!selectedVariant || soldOut}
          style={{
            flex: 1,
            padding: '16px 24px',
            borderRadius: 'var(--mr-radius-pill)',
            background: added ? 'var(--mr-gold-500)' : 'var(--mr-ink-900)',
            color: 'var(--mr-cream-100)',
            border: 0,
            cursor: selectedVariant && !soldOut ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transform: addedAnim ? 'scale(0.96)' : 'scale(1)',
            transition:
              'background var(--mr-dur-medium) var(--mr-ease-out), transform var(--mr-dur-instant) var(--mr-ease-snappy), box-shadow var(--mr-dur-fast)',
            boxShadow: added ? 'none' : 'var(--mr-shadow-md)',
            willChange: 'transform',
            opacity: selectedVariant && !soldOut ? 1 : 0.6,
          }}
        >
          {added ? (
            <>
              <Icon name="check" size={14} /> Added
            </>
          ) : soldOut ? (
            <>{allSoldOut ? 'Out of stock' : 'This size is out of stock'}</>
          ) : (
            <>Add to bag{selectedVariant ? ' — ' : ''}<span style={ctaStyle}>{ctaDisplay}</span></>
          )}
        </button>

        <WishlistHeart
          productId={product.id}
          returnTo={`/products/${product.slug}`}
          variant="pill"
        />
      </div>

      {/* Share — OS share sheet on phones and Chrome/Windows, link copy
          elsewhere. The URL unfurls with the cover photo via the page's
          OpenGraph tags. */}
      <div
        style={{
          marginBottom: 24,
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '520ms',
        }}
      >
        <ShareButton
          url={`/products/${product.slug}`}
          title={product.name}
          text={[productBrand(product), product.tagline].filter(Boolean).join(' — ')}
          traceId="PG-STOREFRONT-CAT-005::EL-BTN-share-product"
        />
      </div>

      {/* Gender + fragrance family badges */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 32,
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '540ms',
        }}
      >
        {[product.gender, product.fragranceFamily].filter(Boolean).map((tag) => (
          <span
            key={tag}
            data-trace-id={`PG-STOREFRONT-CAT-005::EL-BADGE-product-tag@${tag}`}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--mr-radius-pill)',
              border: '1px solid var(--mr-hairline)',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.16em',
              textTransform: 'capitalize',
              color: 'var(--mr-fg-3)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Service row */}
      <div
        data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-shipping-service-info"
        style={{
          marginTop: 'auto',
          paddingTop: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 'var(--mr-text-xs)',
          color: 'var(--mr-fg-3)',
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '600ms',
        }}
      >
        {/* Admin-editable under Storefront -> Product section. Was hardcoded,
            so changing a shipping threshold needed a code deploy. */}
        {perks.map((perk) => (
          <span
            key={perk.id}
            data-trace-id={`PG-STOREFRONT-CAT-005::EL-TEXT-product-perk@${perk.id}`}
            style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}
          >
            <Icon name={perk.icon} size={14} /> {perk.text}
          </span>
        ))}
      </div>
    </div>
  );
});

/** The dark editorial pause between the photographs and the closing panel. */
const EditorialMoment = React.memo(function EditorialMoment({
  product,
}: {
  product: ApiProduct;
}) {
  return (
    <div
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-editorial-quote-panel"
      className="relative flex items-center justify-center overflow-hidden py-[clamp(96px,22vw,160px)] lg:h-screen lg:py-0"
      style={{ background: 'var(--mr-ink-900)', minHeight: '60vh' }}
    >
      <div className="relative z-[1] px-[clamp(24px,6vw,64px)] text-center">
        <div className="mr-breath" style={{ display: 'inline-flex', marginBottom: 32 }}>
          <Sparkle size={28} color="var(--mr-gold-400)" />
        </div>
        <blockquote
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(26px, 3.5vw, 48px)',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            textWrap: 'balance',
            color: 'var(--mr-cream-100)',
            margin: '0 0 32px',
            maxWidth: 540,
          }}
        >
          &ldquo;{product.tagline ?? product.name}&rdquo;
        </blockquote>
        <div
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--mr-gold-400)',
          }}
        >
          {productBrand(product) ?? product.categoryName}
        </div>
      </div>
    </div>
  );
});

/** Placeholder shown when a product has no photographs at all. */
const MediaFallback = React.memo(function MediaFallback({ name }: { name: string }) {
  return (
    <div
      className="flex aspect-[4/5] w-full items-center justify-center lg:aspect-auto lg:h-screen"
      style={{
        background: 'var(--mr-cream-300)',
        fontFamily: 'var(--mr-font-serif)',
        fontStyle: 'italic',
        fontSize: 'var(--mr-text-xl)',
        color: 'var(--mr-fg-3)',
      }}
    >
      {name}
    </div>
  );
});

export default function ApiProductDetail({
  product,
  perks = [],
  onBack,
  onAddToBag,
}: ApiProductDetailProps) {
  const activeVariants = product.variants?.filter((v) => v.isActive) ?? [];
  // Prefer a variant that is actually sellable, so a product whose first size is
  // sold out does not open pre-selected on the one option nobody can buy.
  const defaultVariant =
    activeVariants.find((v) => variantInStock(v)) ?? activeVariants[0] ?? null;
  const [selectedVariant, setSelectedVariant] = React.useState<ProductVariant | null>(defaultVariant);
  const [added, setAdded] = React.useState(false);
  const [addedAnim, setAddedAnim] = React.useState(false);

  // Sticky buy bar visibility (W3.4). Two Add-to-bag buttons on screen at
  // once crowd the layout, so the sticky bar fades out while the main
  // button is visible and comes back the moment it scrolls away.
  //
  // Defaults to "main button not in view" (bar shown) — the safe direction.
  // It only flips to hidden once the observer *confirms* the main button is
  // on screen, and a safety timeout undoes that only if the observer never
  // reports back at all (not on every timeout — unlike `useScrollReveal`'s
  // one-shot safety, this state toggles back and forth for as long as the
  // page is open, so an unconditional timer would fight a legitimately
  // hidden bar after 1.5s). A shopper who cannot reach Add to bag cannot
  // buy, so every failure mode here must leave the bar visible.
  const mainAddToBagRef = React.useRef<HTMLButtonElement | null>(null);
  const [mainButtonInView, setMainButtonInView] = React.useState(false);

  React.useEffect(() => {
    const el = mainAddToBagRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // No element yet, or no IO support (very old browser) — never claim
      // the main button is visible, so the sticky bar just stays up.
      return;
    }
    let observed = false;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        observed = true;
        setMainButtonInView(entry.isIntersecting);
      },
      { threshold: 0.2 },
    );
    io.observe(el);

    const safety = setTimeout(() => {
      if (!observed) setMainButtonInView(false);
    }, 1500);

    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, []);

  // Saving is owned by WishlistHeart itself — see that component. Nothing here
  // needs to know about it, which is why there is no wishlist state on this
  // page any more.

  // Lives on the WRAPPER, never inside the panel. It was applied in both places,
  // so the copy travelled twice the intended distance on phones.
  const copyEnt = useEnterSpring({ preset: 'default', from: { y: 14, opacity: 0, scale: 1 }, delay: 60 });

  // For price crossfade when variant changes. Routed through the same
  // formatter every other price on the page uses (PriceDisplay's
  // formatPrice) — priceAmount is a raw NUMERIC(*,4) string like "400.0000"
  // and must never be glued to the currency code unformatted.
  /**
   * The sticky buy bar's price. Same hook and same inputs as the panel's, so
   * the two prices on screen cannot disagree — one component computing it and
   * passing it down would be tidier, but the panel is React.memo'd and the
   * extra prop would defeat that for no gain: the hook reads one context value.
   */
  const shownPrice = useDiscountedPrice(
    selectedVariant?.priceAmount ?? '0',
    !product.collaboratorId,
  );

  // The crossfade label follows what is actually shown — animating from the
  // old full price to the new full price while the visible figure is discounted
  // would flash a number the shopper never sees anywhere else.
  const priceLabel = selectedVariant
    ? formatPrice(shownPrice.amount, selectedVariant.priceCurrency)
    : '';
  const ctaX = useCrossfade(priceLabel);

  // Cover first, then the product's other photographs. Variant-scoped images
  // are excluded — they belong to a variant view, not the product gallery —
  // and so is the closing image, which has its own place at the end.
  const gallery = carouselMedia(product);
  const closing = closingMedia(product);
  const closingSrc = closing ? mediaImageUrl(closing, { w: 1400, h: 1750 }) : null;

  const soldOut = !!selectedVariant && !variantInStock(selectedVariant);
  // Nothing on the product is buyable — every active variant is at zero.
  const allSoldOut =
    activeVariants.length > 0 && !activeVariants.some((v) => variantInStock(v));

  // No useCallback here on purpose: the React Compiler is on for this app and
  // memoises these itself. Wrapping them by hand made it bail out of optimising
  // the whole component.
  const handleAdd = (source: 'pdp' | 'sticky') => {
    // Enforced here as well as by the disabled button: the click handler is what
    // actually adds to the bag, and a keyboard or programmatic activation must
    // not slip past a visual state.
    if (added || !selectedVariant || soldOut) return;
    setAdded(true);
    setAddedAnim(true);
    onAddToBag(selectedVariant, source);
    setTimeout(() => setAddedAnim(false), 600);
    setTimeout(() => setAdded(false), 2400);
  };

  // product_view fires exactly once per mount — the ref (not a dependency
  // array) is what survives React StrictMode's dev-only double-invoke of this
  // effect, and it deliberately never reruns on a variant change.
  const firedProductView = React.useRef(false);
  React.useEffect(() => {
    if (firedProductView.current) return;
    firedProductView.current = true;
    track('product_view', {
      productId: product.id,
      variantId: defaultVariant?.id,
      priceMinor: subtotalToMinor(defaultVariant?.priceAmount ?? '0'),
      brand: productBrand(product) ?? undefined,
      categoryId: product.categoryId,
      inStock: defaultVariant ? variantInStock(defaultVariant) : !allSoldOut,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // Fires once per page view, the first time the shopper actually looks past
  // the cover photo — not on every dot/arrow/swipe after that.
  const firedGalleryOpen = React.useRef(false);
  const handleGalleryOpen = (index: number) => {
    if (firedGalleryOpen.current) return;
    firedGalleryOpen.current = true;
    track('gallery_open', { productId: product.id, index });
  };

  const handleSelectVariant = (v: ProductVariant) => {
    setSelectedVariant(v);
    track('variant_select', {
      productId: product.id,
      variantId: v.id,
      attribute: v.values?.[0]?.attributeName,
    });
  };


  return (
    <div
      data-testid="product-layout"
      className="flex flex-col lg:min-h-screen lg:flex-row"
      style={{ background: 'var(--mr-cream-200)' }}
    >
      {/* Back — above the photographs on a phone, inside the sticky column on a
          laptop. Two placements, one component, no JS width check. */}
      <div className="order-1 px-[clamp(20px,5vw,32px)] pt-7 lg:hidden">
        <ProductBackButton onBack={onBack} />
      </div>

      {/* LEFT on a laptop / BELOW the photographs on a phone: the copy. */}
      <aside
        className="order-3 lg:order-1 lg:sticky lg:top-0 lg:h-screen lg:w-[46%] lg:flex-shrink-0 lg:self-start lg:overflow-y-auto lg:border-r xl:w-[42%] scrollbar-hide"
        style={{ borderColor: 'var(--mr-hairline)' }}
      >
        <div
          className="flex flex-col px-[clamp(20px,5vw,32px)] pb-[clamp(64px,14vw,96px)] pt-[clamp(32px,8vw,56px)] lg:h-full lg:px-[clamp(32px,4vw,56px)] lg:pt-[clamp(40px,5vw,64px)]"
          style={{ background: 'inherit' }}
        >
          <div className="mb-12 hidden lg:block">
            <ProductBackButton onBack={onBack} />
          </div>
          <div style={{ ...copyEnt, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <ProductInfoPanel
              product={product}
              perks={perks}
              activeVariants={activeVariants}
              selectedVariant={selectedVariant}
              onSelectVariant={handleSelectVariant}
              added={added}
              addedAnim={addedAnim}
              soldOut={soldOut}
              allSoldOut={allSoldOut}
              onAdd={() => handleAdd('pdp')}
              ctaStyle={ctaX.style}
              ctaDisplay={ctaX.display}
              addToBagRef={mainAddToBagRef}
            />
          </div>
        </div>
      </aside>

      {/* RIGHT column on a laptop / interleaved with <aside> on a phone: the
          photographs, then the reviews. Bug 2 (task-storefront-bugs): on a
          phone "What people say" used to render before the product details
          because it lived inside this single flex item (order-2), ahead of
          <aside> (order-3) — the fix is not to pull <ProductReviews> out to
          the top level, because that would make it a THIRD flex column
          alongside <aside>/<main> on a laptop (`lg:flex-row`) and break the
          two-column desktop layout. Instead this wrapper is `contents` by
          default: it un-boxes itself so its two children below become
          independent flex items of THIS component's own row, each free to
          carry its own mobile `order` — media block at order-2 (before
          <aside>), reviews block at order-4 (after it). At `lg:` the wrapper
          becomes a real flex column again (`lg:flex lg:flex-col`) and
          re-collapses into the single right-hand flex item <main> used to
          be, so the desktop layout — <aside> order-1, this column order-2 —
          is byte-for-byte the same as before; reviews were already below the
          info panel there. */}
      <div className="contents lg:order-2 lg:flex lg:min-h-screen lg:flex-1 lg:flex-col">
        {/* FIRST on a phone / top of the right column on a laptop: the
            photographs. */}
        <main className="order-2">
          {gallery.length > 0 ? (
            <ProductGallery product={product} items={gallery} onOpen={handleGalleryOpen} />
          ) : (
            <MediaFallback name={product.name} />
          )}

          <EditorialMoment product={product} />
        </main>

        {/* AFTER <aside> (the product details) on a phone / below the
            photographs on a laptop — never rendered a second time, since
            ProductReviews fetches its own data and owns the one "write a
            review" entry point. */}
        <div className="order-4">
          <ProductReviews
            productId={product.id}
            productName={product.name}
            initialAverage={product.reviewsAverage ?? null}
            initialCount={product.reviewsCount ?? 0}
          />

          {/* The page ends on a photograph. What used to be here was an
              "Available sizes" panel repeating the size the shopper had already
              picked at the top. When no closing image is marked, the page simply
              ends — the panel is not coming back. */}
          {closing && closingSrc ? (
            <div
              data-trace-id="PG-STOREFRONT-CAT-005::EL-IMG-product-closing-image"
              className="relative aspect-[4/5] w-full overflow-hidden lg:aspect-auto lg:h-screen"
              style={{ background: 'var(--mr-cream-300)' }}
            >
              <Image
                src={closingSrc}
                alt={closing.altText ?? product.name}
                fill
                sizes="(min-width: 1024px) 58vw, 100vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Sticky buy bar — phones only. The CTA in the copy column scrolls away
          the moment someone looks at the photographs, and on a phone the whole
          point is that buying stays under the thumb. On a laptop the copy
          column is already pinned, so this would be a second button saying the
          same thing. */}
      <div
        data-testid="buy-bar"
        data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-sticky-buy-bar"
        aria-hidden={mainButtonInView}
        // order-5: after the reviews block (order-4) — the reviews fix bumped
        // this bar down one slot so it stays last in mobile flow, matching
        // its role as the final, always-on-top purchase action.
        className="sticky z-30 order-5 flex items-center gap-3 border-t px-[clamp(16px,4vw,24px)] pt-3 lg:hidden"
        style={{
          borderColor: 'var(--mr-hairline)',
          background: 'color-mix(in oklab, var(--mr-cream-100) 88%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          // Stacks directly on top of the mobile bottom nav rather than
          // being covered by it: MobileBottomNav.tsx measures its own
          // rendered height (0 when hidden) and publishes it here, so this
          // bar sits flush on the true bottom edge — with just its own
          // safe-area padding — the moment the nav is out of the way, and
          // rides up to sit right above it the moment the nav reappears.
          bottom: 'var(--mr-bottom-nav-offset, 0px)',
          // Only add the safe-area inset ourselves when the bottom nav is NOT
          // sitting under us — the nav's own box already carries that inset
          // (see MobileBottomNav.tsx's `paddingBottom: env(safe-area-inset-
          // bottom)`), and `bottom` above already lifts this bar clear of the
          // nav's full height. Stacking both paddings on top of that offset
          // double-counts the inset and leaves a dead gap above the buttons
          // on notched phones. `max(0px, inset - offset)` collapses to 0 once
          // the offset (nav height, which itself contains the inset) is at
          // least as tall as the inset alone — i.e. whenever the nav is
          // visible — and falls back to the full inset when the offset is 0
          // (nav hidden, so this bar owns the safe area itself).
          paddingBottom:
            'calc(12px + max(0px, env(safe-area-inset-bottom) - var(--mr-bottom-nav-offset, 0px)))',
          opacity: mainButtonInView ? 0 : 1,
          transform: mainButtonInView ? 'translateY(8px)' : 'translateY(0)',
          pointerEvents: mainButtonInView ? 'none' : 'auto',
          transition: `opacity var(--mr-dur-normal) var(--mr-ease-out), transform var(--mr-dur-normal) var(--mr-ease-out), bottom var(--mr-dur-normal) var(--mr-ease-out)`,
        }}
      >
        <div style={{ minWidth: 0, flex: '0 1 auto' }}>
          <div
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selectedVariant ? variantLabel(selectedVariant) : product.name}
          </div>
          {selectedVariant ? (
            <PriceDisplay
              amount={shownPrice.amount}
              wasAmount={shownPrice.wasAmount}
              currency={selectedVariant.priceCurrency}
              style={{ fontSize: 'var(--mr-text-md)' }}
            />
          ) : null}
        </div>

        <button
          data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag-sticky"
          onClick={() => handleAdd('sticky')}
          disabled={!selectedVariant || soldOut}
          style={{
            flex: 1,
            minHeight: 48,
            padding: '14px 20px',
            borderRadius: 'var(--mr-radius-pill)',
            background: added ? 'var(--mr-gold-500)' : 'var(--mr-ink-900)',
            color: 'var(--mr-cream-100)',
            border: 0,
            cursor: selectedVariant && !soldOut ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: selectedVariant && !soldOut ? 1 : 0.6,
            transform: addedAnim ? 'scale(0.97)' : 'scale(1)',
            transition:
              'background var(--mr-dur-medium) var(--mr-ease-out), transform var(--mr-dur-instant) var(--mr-ease-snappy)',
          }}
        >
          {added ? (
            <>
              <Icon name="check" size={14} /> Added
            </>
          ) : soldOut ? (
            <>{allSoldOut ? 'Out of stock' : 'This size is out'}</>
          ) : (
            <>Add to bag</>
          )}
        </button>

        <WishlistHeart
          productId={product.id}
          returnTo={`/products/${product.slug}`}
          size={44}
          traceId="PG-STOREFRONT-CAT-005::EL-BTN-toggle-wishlist-sticky"
        />
      </div>
    </div>
  );
}

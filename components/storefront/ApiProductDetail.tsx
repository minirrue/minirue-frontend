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
import { productPath } from '@/lib/routes';
import VariantPicker from './VariantPicker';
import PriceDisplay, { formatPrice } from './PriceDisplay';
import { useDiscountedPrice } from '@/lib/hooks/use-sitewide-discount';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import Sparkle from '@/components/ui/Sparkle';
import type { ProductSectionConfig } from '@/lib/api/storefront';
import ShareButton from './ShareButton';
import WordReveal from '@/components/ui/WordReveal';
import { useEnterSpring, useCrossfade } from '@/lib/motion/hooks';
import { track } from '@/lib/analytics';
import { subtotalToMinor } from '@/lib/checkout/checkout-money';

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

/**
 * Split for the third time, and for the sharpest reason of the three: this
 * section exists ONLY for the minority of products that belong to a set, and
 * it renders nothing at all for the rest. Folding it into the route's first
 * load would make every product page carry a component most of them never
 * show. Its own chunk, fetched when the shopper reaches the end of the page.
 */
const BundleCrossSell = dynamic(() => import('./BundleCrossSell'));

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

/**
 * The item's code, copied on tap.
 *
 * Deliberately quiet — a mono label, not a button that competes with Share.
 * Most shoppers never need it; the one who does is on a chat with support
 * being asked which item they mean, and for them it is the difference between
 * a precise answer and a description.
 */
const SkuCopyButton = React.memo(function SkuCopyButton({ sku }: { sku: string }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context, permission denied). The code is
      // still on screen and selectable, so there is nothing to recover from.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      // The visible text is the code; the accessible name has to say what the
      // code IS, or a screen reader announces a string of letters and numbers
      // with no idea it is a button that copies them.
      aria-label={copied ? `Item code ${sku} copied` : `Copy item code ${sku}`}
      title="Copy item code"
      data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-copy-sku"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        // Matches the Share pill's height so the row reads as one line of
        // controls rather than two things that happen to be adjacent.
        minHeight: 40,
        padding: '0 14px',
        borderRadius: 'var(--mr-radius-pill)',
        // --mr-hairline, not --mr-border: this control is documented above as
        // deliberately quieter than Share, but carried the heavier of the two
        // border tokens, which read as the louder of the pair.
        border: '1px solid var(--mr-hairline)',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--mr-font-mono, ui-monospace, monospace)',
        fontSize: 'var(--mr-text-xs)',
        letterSpacing: '0.04em',
        color: copied ? 'var(--mr-fg)' : 'var(--mr-fg-3)',
        transition: 'color var(--mr-dur-fast) var(--mr-ease-out)',
        // A full SKU runs ~42 characters and stretched this pill several times
        // wider than Share. The label already truncates with an ellipsis; this
        // bounds how far it can grow. The full code is still what gets copied.
        maxWidth: 'min(100%, 260px)',
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={13} />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {copied ? 'Copied' : sku}
      </span>
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
  soldOut: boolean;
  allSoldOut: boolean;
  /** Nothing to sell at all — no active variant. Distinct from allSoldOut,
   *  which means "we stock this and have none". */
  unavailable: boolean;
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
  soldOut,
  allSoldOut,
  unavailable,
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
    // The server's answer, not `!product.collaboratorId`.
    //
    // Ownership is the product AND its brand; the local check saw only the
    // product, so a product on a partner's brand was struck through here and
    // charged in full at checkout (#3). `?? false` because an older API
    // response may not carry the field, and the safe answer to "unknown" is
    // "no discount" — a discount shown but not honoured is worse than one
    // missed.
    product.isMinirueOwned ?? false,
    // A floor-capped variant is charged the server's figure (backend#155).
    selectedVariant?.id,
  );

  /**
   * Hoisted so the badge row can be skipped entirely when it is empty.
   *
   * Most of the catalogue carries neither `gender` nor `fragranceFamily`
   * (Black Opium is one of them), and the row was still rendering as an empty
   * flex box with a 32px bottom margin — 32px of nothing in a column that is
   * measurably short of room on a 720-tall laptop, which is part of why the
   * service lines below it ended up under the fold (#42).
   */
  const tags = [product.gender, product.fragranceFamily].filter(Boolean) as string[];

  return (
    <div
      data-testid="product-info-panel"
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-info-panel"
      /**
       * Centred, not left-aligned (#42).
       *
       * The owner's report was "'BLACK OPIUM EAU DE PARFUM' YSL … where we put
       * brand name and name of item its not properly centered". Measured, the
       * COLUMN was already centred: `lg:px-[clamp(32px,4vw,56px)]` puts 57.6px
       * of padding on both sides of a 605px column at 1440. What is off is the
       * TYPE — left-aligned and ragged, so on the widest line ("EAU DE
       * PARFUM", ending ~460px) the block carried 57px of space on the left
       * and ~145px on the right and read as shoved against the left edge.
       * Balancing the padding would have been a no-op on an already-symmetric
       * box, so the honest reading of the complaint is the alignment.
       *
       * It is the whole panel, not just the brand and the title. Centring the
       * eyebrow and the H1 while the price, the OPTIONS label and the pills
       * below them stayed left would read as a mistake rather than a choice —
       * and every row here centres cleanly: the price is one short line, the
       * size pills are a wrapping row, the buy button is already full width
       * with its own label centred. It also matches the page's own voice; the
       * editorial panel between the photographs is centred type on the same
       * product.
       *
       * `alignItems` is deliberately left at `stretch`. Switching it to
       * `center` would shrink-wrap every child and cost the buy button its
       * full width.
       */
      /*
        Centred on a PHONE, left-aligned from `lg` up — the owner's follow-up
        after #42 shipped it centred everywhere: "on mobile focus on center
        text and everything inside product single page but on desktop keep old
        same".

        Both readings are right for their own width, which is why one value
        could not serve. On a 390px column the measure is so narrow that almost
        every line fills it, so the rag is invisible and centring reads as
        composed. At 1440 the panel is a 605px column beside a full-height
        photograph, and centred type there fights the photograph's own edge
        instead of settling against it.

        A class rather than the inline `textAlign` it replaces: an inline style
        cannot carry a breakpoint, and the alternative — branching on
        `useBreakpoint()` — would make the first paint depend on a client-side
        measurement on a server-rendered page.
      */
      className="text-center lg:text-left"
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
          {/* Availability as text in the served HTML, for screen readers and
              for AI crawlers that read no JS or JSON-LD (#150). The page shows
              it visually through the buy button. */}
          <span className="sr-only">{allSoldOut ? ' Out of stock' : ' In stock'}</span>
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
            isMinirueOwned={product.isMinirueOwned ?? false}
            selectedId={selectedVariant?.id ?? null}
            onChange={onSelectVariant}
            // The label inherits the panel's alignment, but the pills are a
            // flex row and have to be told. Same breakpoint as the panel
            // (`text-center lg:text-left`) — pills that stayed centred while
            // the type beside them moved would read as a mistake.
            align="center-until-lg"
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
          // Height-aware, like the column's top padding: a 720-tall laptop is
          // short of room and this is the largest discretionary gap in the
          // panel. Unchanged on anything 900 and taller.
          marginBottom: 'clamp(24px,4vh,36px)',
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '500ms',
        }}
      >
        {/* The house button (frontend#105) — same shape as every other CTA on
            the site. Gold once added; Button's own press scale replaces the
            hand-rolled one. */}
        <Button
          ref={addToBagRef}
          traceId="PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag"
          variant={added ? 'gold' : 'primary'}
          onClick={onAdd}
          disabled={!selectedVariant || soldOut || unavailable}
          style={{ flex: 1 }}
        >
          {added ? (
            <>
              <Icon name="check" size={14} /> Added
            </>
          ) : unavailable ? (
            // "Unavailable", not "Out of stock": nothing was withdrawn from
            // sale, there is nothing here to sell in the first place.
            <>Currently unavailable</>
          ) : soldOut ? (
            <>{allSoldOut ? 'Out of stock' : 'This size is out of stock'}</>
          ) : (
            <>Add to bag{selectedVariant ? ' — ' : ''}<span style={ctaStyle}>{ctaDisplay}</span></>
          )}
        </Button>

        <WishlistHeart
          productId={product.id}
          /**
           * The CANONICAL path, not `/products/{slug}`.
           *
           * That legacy route is a permanentRedirect shim now, so a guest who
           * tapped save, signed in, and was returned here landed on a 308 and
           * bounced through to /shop/{category}/{product} — a visible extra
           * navigation at the exact moment they were expecting to be back
           * where they started.
           */
          returnTo={productPath(product)}
          variant="pill"
        />
      </div>

      {/* Share — OS share sheet on phones and Chrome/Windows, link copy
          elsewhere. The URL unfurls with the cover photo via the page's
          OpenGraph tags.

          The SKU sits alongside it because both are the same gesture: taking
          something about this exact item somewhere else. A shopper messaging
          support is asked "which one?", and the SKU answers it precisely where
          "the gold one, the intense" does not — the shop's search accepts a
          pasted SKU now, so the code they copy here resolves straight back to
          this page at the other end. It is the SELECTED VARIANT's code, not
          the product's, because 50ml and 100ml are different things to send. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 'clamp(16px,2.5vh,24px)',
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '520ms',
        }}
      >
        <ShareButton
          /**
           * The canonical path, not the legacy one.
           *
           * A shared link is the longest-lived artefact this page produces —
           * it goes into WhatsApp threads and stays there — and this was
           * handing out `/products/{slug}`, which permanently redirects now.
           * Every recipient paid a 308, and the URL they saw in the share
           * sheet was not the URL of the page being shared (owner,
           * 2026-08-21: "fix share, it has the old url").
           */
          url={productPath(product)}
          title={product.name}
          text={[productBrand(product), product.tagline].filter(Boolean).join(' — ')}
          traceId="PG-STOREFRONT-CAT-005::EL-BTN-share-product"
        />
        {selectedVariant?.sku && <SkuCopyButton sku={selectedVariant.sku} />}
      </div>

      {/* Gender + fragrance family badges — nothing at all when there are
          none, rather than an empty 32px-tall gap. */}
      {tags.length > 0 && (
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: 32,
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '540ms',
        }}
      >
        {tags.map((tag) => (
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
      )}

      {/*
        Service row.

        It used to be `marginTop: 'auto'`, which parked it on the bottom edge
        of a `100vh` column — and the column does not start at the top of the
        viewport. `components/layout/Header.tsx` is `position: sticky` and 89px
        tall until the page is scrolled, so at rest an `h-screen` column runs
        from y=89 to y=989 on a 900-tall screen and its last 89px — precisely
        where the auto margin put these two lines — sits below the fold. That
        is the "cut out" in #42: measured on production, 1440x800 sliced the
        second line 17px below the edge and 1280x720 put both lines 55-85px
        under it.

        So the row is no longer bottom-anchored. It follows the copy it
        belongs to, which is where it reads better anyway — the auto margin
        was also opening a ~150px hole in the middle of the column between the
        share row and these lines. `paddingTop` carries the separation on its
        own.
      */}
      <div
        data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-shipping-service-info"
        style={{
          paddingTop: 'clamp(24px,4vh,40px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
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

        {/*
          The description, from the dashboard.

          It sat under the buy button first; the owner moved it here
          (2026-08-21: "description here is better than under the share
          button… under the photos better"), and the panel is the better home
          for a reason worth writing down. This section already existed to be
          the pause between the photographs and the closing panel — a full
          dark screen holding one line of type. It was doing that job with the
          product NAME repeated in quote marks, which is decoration standing in
          for content. Real copy is what the moment was built for; the shopper
          arrives here having already scrolled past the photographs, which is
          exactly when someone is reading rather than deciding.

          Kept centred and narrow to match the blockquote above it rather than
          becoming a left-aligned article — this is still an editorial pause,
          not a spec sheet. The TEXT is centred too, on every width (owner,
          2026-09-13: "center center on mobile and desktop") — a centred column
          of left-ragged lines read as misaligned under the centred quote.
        */}
        {product.description && (
          <div
            data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-description"
            style={{
              marginTop: 40,
              // Own hairline above it so the copy reads as a separate thought
              // from the brand line, without a second heading to announce it.
              paddingTop: 36,
              borderTop: '1px solid color-mix(in srgb, var(--mr-gold-400) 28%, transparent)',
              maxWidth: 620,
              marginInline: 'auto',
              textAlign: 'center',
            }}
          >
            {/* Split on blank lines so copy written as paragraphs reads as
                paragraphs. Rendered as text, never HTML — a description field
                is admin-authored, but it is not a template. */}
            {product.description
              .split(/\n\s*\n/)
              .map((para) => para.trim())
              .filter(Boolean)
              .map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: 'var(--mr-font-ui)',
                    fontSize: 'clamp(14px, 1.05vw, 16px)',
                    lineHeight: 1.8,
                    // cream-300, not cream-100: the blockquote above is the
                    // loudest thing on this screen and must stay that way.
                    color: 'var(--mr-cream-300)',
                    textWrap: 'pretty',
                    margin: i === 0 ? 0 : '18px 0 0',
                  }}
                >
                  {para}
                </p>
              ))}
          </div>
        )}
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
    // The server's answer, not `!product.collaboratorId`.
    //
    // Ownership is the product AND its brand; the local check saw only the
    // product, so a product on a partner's brand was struck through here and
    // charged in full at checkout (#3). `?? false` because an older API
    // response may not carry the field, and the safe answer to "unknown" is
    // "no discount" — a discount shown but not honoured is worse than one
    // missed.
    product.isMinirueOwned ?? false,
    // A floor-capped variant is charged the server's figure (backend#155).
    selectedVariant?.id,
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
  /**
   * Nothing to sell AT ALL — every variant removed or deactivated.
   *
   * Distinct from `allSoldOut`, which means "we stock this and have none".
   * Both of the flags above are guarded on a variant existing (`!!selected`,
   * `length > 0`), so with zero active variants both were false, the button
   * fell through to the "Add to bag" branch, and it rendered greyed out with
   * no explanation — a shopper could not tell a sold-out product from a broken
   * page (owner, 2026-08-21).
   */
  const unavailable = activeVariants.length === 0;

  // No useCallback here on purpose: the React Compiler is on for this app and
  // memoises these itself. Wrapping them by hand made it bail out of optimising
  // the whole component.
  const handleAdd = (source: 'pdp' | 'sticky') => {
    // Enforced here as well as by the disabled button: the click handler is what
    // actually adds to the bag, and a keyboard or programmatic activation must
    // not slip past a visual state.
    if (added || !selectedVariant || soldOut) return;
    setAdded(true);
    onAddToBag(selectedVariant, source);
    setTimeout(() => setAdded(false), 2400);
  };

  /**
   * The DISPLAYED price for `product_view`, not the list price.
   *
   * `defaultVariant?.priceAmount` is what the product costs before a running
   * markdown; `shownPrice` above already runs the same variant through the
   * same floor-capped offer the panel prints on screen for the shopper looking
   * at this exact page (#142). Same hook, same inputs shape as `shownPrice`,
   * just for the default variant rather than whichever one is selected.
   *
   * The event schema has no second field for the list price (`priceMinor` is
   * the only money field `product_view` carries), so there is nothing to send
   * it as without failing the collector's strict prop check.
   */
  const defaultVariantPrice = useDiscountedPrice(
    defaultVariant?.priceAmount ?? '0',
    product.isMinirueOwned ?? false,
    defaultVariant?.id,
  );

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
      priceMinor: subtotalToMinor(defaultVariantPrice.amount),
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

      {/* LEFT on a laptop / BELOW the photographs on a phone: the copy.

          `lg:h-screen` + `lg:overflow-y-auto` is what pins this column beside
          the photographs, and it stays — but two details of it were cutting
          the service lines off the bottom of the page (#42).

          1. `scrollbar-hide` is gone from this element. It was hiding the only
             signal that the column has more to read: on a 720-tall laptop the
             copy needs ~810px and there is no other affordance. It is kept
             where it belongs — AccountLayoutClient's horizontal mobile nav
             scroller, where a hidden bar is the convention and a sideways
             strip of chips announces itself as swipeable. A vertical column
             that looks like a finished page does not. In its place: a thin
             hairline-coloured bar, quiet enough for this layout and honest
             about the overflow. */}
      <aside
        // Own wheel scrolling under Lenis (frontend#87) — see LenisProvider.
        data-lenis-prevent
        className="order-3 lg:order-1 lg:sticky lg:top-0 lg:h-screen lg:w-[46%] lg:flex-shrink-0 lg:self-start lg:overflow-y-auto lg:border-r xl:w-[42%]"
        style={{
          borderColor: 'var(--mr-hairline)',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--mr-hairline) transparent',
        }}
      >
        {/*
          2. `lg:min-h-full`, not `lg:h-full`. At exactly 100% the box could
             never grow, so when the copy outgrew it the overflow was absorbed
             by this element's own 96px of bottom padding instead of extending
             the scroll area — measured on production, `scrollHeight ===
             clientHeight` at every viewport, i.e. the column was not
             scrollable AT ALL and the last line simply ended 4px above the
             bottom edge with no way to bring the padding back. As a minimum
             it still fills the viewport (so a short product's copy is not
             floating in a half-height panel), but it may now exceed it, which
             is what makes the padding below the last line real space.

          The top rhythm is height-aware as well as width-aware. `5vw` says
          nothing about a 1440x720 laptop, which is wide and short — exactly
          the shape where this column runs out of room — so a plain
          `max-height` query tightens the head of the column there and leaves
          a normal laptop alone. 820px is the threshold because a 900-tall
          screen has room to spare and an 800-tall one does not.
        */}
        <div
          className="flex flex-col px-[clamp(20px,5vw,32px)] pb-[clamp(64px,14vw,96px)] pt-[clamp(32px,8vw,56px)] lg:min-h-full lg:px-[clamp(32px,4vw,56px)] lg:pt-[clamp(40px,5vw,64px)] lg:[@media(max-height:820px)]:pt-8"
          style={{ background: 'inherit' }}
        >
          <div className="mb-12 hidden lg:block lg:[@media(max-height:820px)]:mb-6">
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
              soldOut={soldOut}
              allSoldOut={allSoldOut}
              unavailable={unavailable}
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
      {/* `lg:min-w-0` is load-bearing, not tidying. As a `lg:flex-1` item this
          column's `min-width` resolves to `auto`, i.e. its min-content width —
          so a horizontally scrollable child (the bundle rail below) sized the
          COLUMN to the full width of its cards instead of scrolling inside it,
          pushing the last card and the rail's arrows off the right of the
          window. It only matters at `lg:`: on a phone this wrapper is
          `display: contents`, so its children are items of a COLUMN flex
          container, where `min-width: auto` is not the main axis and never
          inflated anything. Nothing else in here has ever wanted more width
          than the 54% this column is given, so this cannot change the existing
          layout — it can only stop a child from growing it. */}
      <div className="contents lg:order-2 lg:flex lg:min-h-screen lg:min-w-0 lg:flex-1 lg:flex-col">
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

          {/* BETWEEN the reviews and the closing photograph, deliberately —
              not appended.

              The closing image is the page's full stop (see the note below:
              "the page ends on a photograph"), so a commercial rail placed
              AFTER it would be something printed past the last page. Reviews
              → sets → photograph reads as proof, then the offer, then the
              sign-off, and it still satisfies the ask: after the product
              content, before the footer.

              It is inside this column rather than a third top-level flex item
              for the reason the wrapper's own comment gives — a third item
              would break the two-column desktop layout. So it spans the
              photograph column on a laptop and the full width on a phone,
              which is exactly the measure the gallery, the editorial block and
              the reviews already occupy. */}
          <BundleCrossSell productId={product.id} />

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

        <Button
          traceId="PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag-sticky"
          variant={added ? 'gold' : 'primary'}
          onClick={() => handleAdd('sticky')}
          disabled={!selectedVariant || soldOut}
          style={{ flex: 1 }}
        >
          {added ? (
            <>
              <Icon name="check" size={14} /> Added
            </>
          ) : unavailable ? (
            // Same three states as the main button above — a sticky bar that
            // disagreed with the button it mirrors would be worse than none.
            <>Unavailable</>
          ) : soldOut ? (
            <>{allSoldOut ? 'Out of stock' : 'This size is out'}</>
          ) : (
            <>Add to bag</>
          )}
        </Button>

        <WishlistHeart
          productId={product.id}
          returnTo={productPath(product)}
          size={44}
          traceId="PG-STOREFRONT-CAT-005::EL-BTN-toggle-wishlist-sticky"
        />
      </div>
    </div>
  );
}

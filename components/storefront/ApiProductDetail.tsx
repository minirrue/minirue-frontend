'use client';

import React from 'react';
import Image from 'next/image';
import type { ApiProduct, ProductVariant } from '@/lib/api/catalog';
import {
  primaryMedia,
  carouselMedia,
  mediaImageUrl,
  productBrand,
  productByline,
  variantLabel, variantInStock } from '@/lib/api/catalog';
import VariantPicker from './VariantPicker';
import PriceDisplay from './PriceDisplay';
import Icon from '@/components/ui/Icon';
import Sparkle from '@/components/ui/Sparkle';
import type { ProductSectionConfig } from '@/lib/api/storefront';
import ShareButton from './ShareButton';
import WordReveal from '@/components/ui/WordReveal';
import { useEnterSpring, useCrossfade } from '@/lib/motion/hooks';

interface ApiProductDetailProps {
  product: ApiProduct;
  /** Service promises from Storefront -> Product section. */
  perks?: ProductSectionConfig['perks'];
  onBack: () => void;
  onAddToBag: (variant: ProductVariant) => void;
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

const WishlistHeartButton = React.memo(function WishlistHeartButton({
  saved,
  onToggle,
}: {
  saved: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-toggle-wishlist"
      onClick={onToggle}
      style={{
        width: 52,
        height: 52,
        borderRadius: 'var(--mr-radius-pill)',
        background: 'var(--mr-cream-200)',
        border: '1px solid var(--mr-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform var(--mr-dur-fast) var(--mr-ease-spring), background var(--mr-dur-fast)',
        transform: saved ? 'scale(1.08)' : 'scale(1)',
        flexShrink: 0,
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill={saved ? 'var(--mr-crimson-500)' : 'none'}
        stroke={saved ? 'var(--mr-crimson-500)' : 'var(--mr-ink-700)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: 'transform var(--mr-dur-medium) var(--mr-ease-spring), fill var(--mr-dur-medium), stroke var(--mr-dur-medium)',
          transform: saved ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
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
  saved: boolean;
  onToggleSaved: () => void;
  ctaStyle: React.CSSProperties;
  ctaDisplay: string;
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
  saved,
  onToggleSaved,
  ctaStyle,
  ctaDisplay,
}: ProductInfoPanelProps) {
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
              amount={selectedVariant.priceAmount}
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

        <WishlistHeartButton saved={saved} onToggle={onToggleSaved} />
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
  const [saved, setSaved] = React.useState(false);

  // Lives on the WRAPPER, never inside the panel. It was applied in both places,
  // so the copy travelled twice the intended distance on phones.
  const copyEnt = useEnterSpring({ preset: 'default', from: { y: 14, opacity: 0, scale: 1 }, delay: 60 });

  // For price crossfade when variant changes
  const priceLabel = selectedVariant
    ? `${selectedVariant.priceCurrency} ${selectedVariant.priceAmount}`
    : '';
  const ctaX = useCrossfade(priceLabel);

  // Cover = the thumbnail used everywhere outside this page. Carousel = the
  // cover plus the product's other images, shown inside the page.
  const media = primaryMedia(product);
  const imgSrc = media ? mediaImageUrl(media, { w: 1400, h: 1750 }) : null;
  const imgAlt = media?.altText ?? product.name;
  const gallery = carouselMedia(product);

  const soldOut = !!selectedVariant && !variantInStock(selectedVariant);
  // Nothing on the product is buyable — every active variant is at zero.
  const allSoldOut =
    activeVariants.length > 0 && !activeVariants.some((v) => variantInStock(v));

  const handleAdd = React.useCallback(() => {
    // Enforced here as well as by the disabled button: the click handler is what
    // actually adds to the bag, and a keyboard or programmatic activation must
    // not slip past a visual state.
    if (added || !selectedVariant || soldOut) return;
    setAdded(true);
    setAddedAnim(true);
    onAddToBag(selectedVariant);
    setTimeout(() => setAddedAnim(false), 600);
    setTimeout(() => setAdded(false), 2400);
  }, [added, selectedVariant, soldOut, onAddToBag]);

  const handleToggleSaved = React.useCallback(() => setSaved((s) => !s), []);

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
              onSelectVariant={setSelectedVariant}
              added={added}
              addedAnim={addedAnim}
              soldOut={soldOut}
              allSoldOut={allSoldOut}
              onAdd={handleAdd}
              saved={saved}
              onToggleSaved={handleToggleSaved}
              ctaStyle={ctaX.style}
              ctaDisplay={ctaX.display}
            />
          </div>
        </div>
      </aside>

      {/* RIGHT on a laptop / FIRST on a phone: the photographs. */}
      <main className="order-2 lg:order-2 lg:min-h-screen lg:flex-1">
        {gallery.length > 0 ? (
          gallery.map((m, i) => {
            const src = mediaImageUrl(m, { w: 1400, h: 1750 });
            if (!src) return null;
            return (
              <div
                key={m.id}
                data-trace-id={`PG-STOREFRONT-CAT-005::EL-IMG-product-carousel-image@${m.id}`}
                className="relative aspect-[4/5] w-full overflow-hidden lg:aspect-auto lg:h-screen"
                style={{ background: 'var(--mr-cream-300)' }}
              >
                <Image
                  src={src}
                  alt={m.altText ?? product.name}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            );
          })
        ) : imgSrc ? (
          <div
            data-trace-id="PG-STOREFRONT-CAT-005::EL-IMG-product-hero-image"
            className="relative aspect-[4/5] w-full overflow-hidden lg:aspect-auto lg:h-screen"
            style={{ background: 'var(--mr-cream-300)' }}
          >
            <Image src={imgSrc} alt={imgAlt} fill priority sizes="(min-width: 1024px) 58vw, 100vw" style={{ objectFit: 'cover' }} />
          </div>
        ) : (
          <MediaFallback name={product.name} />
        )}

        <EditorialMoment product={product} />

        {/* Available sizes — a repeat of the picker the shopper already used
            above. Replaced by the admin-marked closing photograph. */}
        {activeVariants.length > 0 && (
          <div
            className="flex flex-col items-center justify-center gap-12 px-[clamp(24px,6vw,64px)] py-[clamp(64px,14vw,96px)]"
            style={{ background: 'var(--mr-cream-300)', minHeight: '60vh' }}
          >
            <div
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-3)',
              }}
            >
              Available sizes
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              {activeVariants.map((v, i) => (
                <div
                  key={v.id}
                  data-trace-id={`PG-STOREFRONT-CAT-005::EL-CARD-variant-size-card@${v.id}`}
                  style={{
                    padding: '28px 24px',
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: 'var(--mr-radius-lg)',
                    border: '1px solid var(--mr-hairline)',
                    textAlign: 'center',
                    backdropFilter: 'blur(12px)',
                    minWidth: 140,
                    animation: 'mr-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-gold-700)',
                      marginBottom: 12,
                    }}
                  >
                    {v.sku}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--mr-font-serif)',
                      fontSize: 'var(--mr-text-lg)',
                      color: 'var(--mr-fg)',
                      marginBottom: 8,
                    }}
                  >
                    {variantLabel(v)}
                  </div>
                  <PriceDisplay
                    amount={v.priceAmount}
                    currency={v.priceCurrency}
                    style={{ fontSize: 'var(--mr-text-sm)' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

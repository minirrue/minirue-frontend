'use client';

import React from 'react';
import Image from 'next/image';
import type { ApiProduct, ProductVariant } from '@/lib/api/catalog';
import { primaryMedia, cloudinaryUrl, lowestPrice } from '@/lib/api/catalog';
import VariantPicker from './VariantPicker';
import PriceDisplay from './PriceDisplay';
import Icon from '@/components/ui/Icon';
import Sparkle from '@/components/ui/Sparkle';
import WordReveal from '@/components/ui/WordReveal';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { useEnterSpring, useCrossfade } from '@/lib/motion/hooks';

interface ApiProductDetailProps {
  product: ApiProduct;
  onBack: () => void;
  onAddToBag: (variant: ProductVariant) => void;
}

export default function ApiProductDetail({ product, onBack, onAddToBag }: ApiProductDetailProps) {
  const { mobile, w } = useBreakpoint();

  const activeVariants = product.variants?.filter((v) => v.isActive) ?? [];
  const defaultVariant = activeVariants[0] ?? null;
  const [selectedVariant, setSelectedVariant] = React.useState<ProductVariant | null>(defaultVariant);
  const [added, setAdded] = React.useState(false);
  const [addedAnim, setAddedAnim] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const copyEnt = useEnterSpring({ preset: 'default', from: { y: 14, opacity: 0, scale: 1 }, delay: 60 });

  // For price crossfade when variant changes
  const priceLabel = selectedVariant
    ? `${selectedVariant.priceCurrency} ${selectedVariant.priceAmount}`
    : '';
  const ctaX = useCrossfade(priceLabel);

  const media = primaryMedia(product);
  const imgSrc = media
    ? cloudinaryUrl(media.cloudinaryPublicId, { w: 1200, h: 1500 })
    : null;
  const imgAlt = media?.altText ?? product.name;

  const handleAdd = () => {
    if (added || !selectedVariant) return;
    setAdded(true);
    setAddedAnim(true);
    onAddToBag(selectedVariant);
    setTimeout(() => setAddedAnim(false), 600);
    setTimeout(() => setAdded(false), 2400);
  };

  const BackButton = () => (
    <button
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

  const InfoPanel = () => (
    <div style={{ ...copyEnt, flex: 1, display: 'flex', flexDirection: 'column' }}>

      <div
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
          marginBottom: 16,
          animation: 'mr-word-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '100ms',
        }}
      >
        {product.brand} · {product.fragranceFamily}
      </div>

      <h1
        style={{
          fontFamily: 'var(--mr-font-serif)',
          fontWeight: 400,
          fontSize: 'clamp(38px, 3.8vw, 56px)',
          lineHeight: 1.0,
          letterSpacing: '-0.015em',
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
          style={{
            marginBottom: 24,
            animation: 'mr-word-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '300ms',
          }}
        >
          <span style={ctaX.style}>
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
          style={{
            marginBottom: 28,
            animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '440ms',
          }}
        >
          <VariantPicker
            variants={activeVariants}
            selectedId={selectedVariant?.id ?? null}
            onChange={setSelectedVariant}
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
          onClick={handleAdd}
          disabled={!selectedVariant}
          style={{
            flex: 1,
            padding: '16px 24px',
            borderRadius: 'var(--mr-radius-pill)',
            background: added ? 'var(--mr-gold-500)' : 'var(--mr-ink-900)',
            color: 'var(--mr-cream-100)',
            border: 0,
            cursor: selectedVariant ? 'pointer' : 'default',
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
            opacity: selectedVariant ? 1 : 0.5,
          }}
        >
          {added ? (
            <>
              <Icon name="check" size={14} /> Added
            </>
          ) : (
            <>Add to bag{selectedVariant ? ' — ' : ''}<span style={ctaX.style}>{ctaX.display}</span></>
          )}
        </button>

        <button
          onClick={() => setSaved((s) => !s)}
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
            transition: 'all var(--mr-dur-fast) var(--mr-ease-spring)',
            transform: saved ? 'scale(1.08)' : 'scale(1)',
            flexShrink: 0,
          }}
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
              transition: 'all var(--mr-dur-medium) var(--mr-ease-spring)',
              transform: saved ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </button>
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
        style={{
          marginTop: 'auto',
          paddingTop: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 'var(--mr-text-xs)',
          color: 'var(--mr-fg-4)',
          animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '600ms',
        }}
      >
        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
          <Icon name="truck" size={14} /> Complimentary shipping over EGP 3,000
        </span>
        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
          <Icon name="gift" size={14} /> Two complimentary samples per order
        </span>
      </div>
    </div>
  );

  if (mobile) {
    return (
      <div style={{ background: 'var(--mr-cream-200)' }}>
        <div style={{ padding: '28px 20px 0' }}>
          <BackButton />
        </div>

        {/* Hero image */}
        <div
          style={{
            margin: '24px 20px 0',
            aspectRatio: '3/4',
            background: 'var(--mr-cream-300)',
            borderRadius: 'var(--mr-radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--mr-shadow-lg)',
            position: 'relative',
          }}
        >
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={imgAlt}
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover' }}
            />
          ) : (
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
              }}
            >
              {product.name}
            </div>
          )}
        </div>

        <div style={{ padding: '32px 20px 96px', ...copyEnt }}>
          <InfoPanel />
        </div>
      </div>
    );
  }

  // Desktop: sticky left + scrollable right
  return (
    <div
      style={{
        background: 'var(--mr-cream-200)',
        display: 'flex',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      {/* LEFT: sticky info panel */}
      <div
        style={{
          width: w < 1100 ? '48%' : '42%',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--mr-hairline)',
          background: 'var(--mr-cream-100)',
          scrollbarWidth: 'none',
        }}
      >
        <div
          style={{
            padding:
              'calc(var(--mr-sp-6) + var(--mr-sp-2)) calc(var(--mr-sp-7) + var(--mr-sp-1)) calc(var(--mr-sp-7) + var(--mr-sp-3))',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: 48 }}>
            <BackButton />
          </div>
          <InfoPanel />
        </div>
      </div>

      {/* RIGHT: scrollable imagery panels */}
      <div style={{ flex: 1, minHeight: '100vh' }}>

        {/* Panel 1 — Hero image */}
        <div
          style={{
            height: '100vh',
            background: 'var(--mr-cream-300)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={imgAlt}
              fill
              priority
              sizes="60vw"
              style={{
                objectFit: 'cover',
                animation: 'mr-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) both',
                animationDelay: '200ms',
              }}
            />
          ) : (
            <div
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontStyle: 'italic',
                fontSize: 'var(--mr-text-3xl)',
                color: 'var(--mr-fg-4)',
              }}
            >
              {product.name}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              left: 40,
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(11,11,11,0.35)',
            }}
          >
            Scroll to explore
          </div>
        </div>

        {/* Panel 2 — Editorial dark moment */}
        <div
          style={{
            height: '100vh',
            background: 'var(--mr-ink-900)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '0 64px',
              zIndex: 1,
              position: 'relative',
            }}
          >
            <div className="mr-breath" style={{ display: 'inline-flex', marginBottom: 32 }}>
              <Sparkle size={28} color="var(--mr-gold-400)" />
            </div>
            <blockquote
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(28px, 3.5vw, 48px)',
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
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
              {product.brand}
            </div>
          </div>
        </div>

        {/* Panel 3 — Variants / details */}
        {activeVariants.length > 0 && (
          <div
            style={{
              minHeight: '60vh',
              background: 'var(--mr-cream-300)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 48,
              padding: 64,
            }}
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
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {activeVariants.map((v, i) => (
                <div
                  key={v.id}
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
                      color: 'var(--mr-gold-500)',
                      marginBottom: 12,
                    }}
                  >
                    {v.bottleType}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--mr-font-serif)',
                      fontSize: 'var(--mr-text-lg)',
                      color: 'var(--mr-fg)',
                      marginBottom: 8,
                    }}
                  >
                    {v.sizeMl}ml
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
      </div>
    </div>
  );
}

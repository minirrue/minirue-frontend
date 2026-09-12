'use client';

import React from 'react';
import Image from 'next/image';
import BottleSVG from '@/components/ui/BottleSVG';
import { heroImageLoader } from '@/lib/images/hero-loader';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';

interface SlideContentProps {
  slide: ResolvedHeroSlide;
  mobile: boolean;
  isActive: boolean;
  onShop?: () => void;
}

/** `#abc` or `#aabbcc`, nothing else. */
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * An admin-authored colour, or `null` if it is not one.
 *
 * These arrive from the dashboard through the API, and a value that reaches a
 * CSS property is a value the browser will try to interpret — historically the
 * hole `expression()` crawled through, and still a way to smuggle `url(...)`
 * fetches or an inherited `!important` past a reviewer. The backend validates
 * hex, but the backend is not the only thing that can put a string in this
 * field: a layout cached before the validation landed, or an older deployment,
 * carries whatever it carried. So this side validates too, and anything that
 * is not a plain hex triple is dropped rather than sanitised — a wrong colour
 * is a bug report, a passed-through string is a vulnerability.
 *
 * Dropping (returning null) is also what makes the whole feature fail safe:
 * every caller treats null exactly like absent, i.e. leaves today's styling.
 */
export function safeHexColor(value: string | null | undefined): string | null {
  return typeof value === 'string' && HEX.test(value) ? value : null;
}

export default function SlideContent({ slide, mobile, isActive, onShop }: SlideContentProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const textDelay = isActive ? 200 : 0;

  // Pick the device-appropriate crop: the portrait image on phones (falling back
  // to the landscape one when no mobile crop was set), the landscape image on
  // larger screens.
  const heroSrc =
    slide.mode === 'image'
      ? mobile
        ? slide.mobileImageUrl ?? slide.imageUrl
        : slide.imageUrl
      : null;
  const usingMobileCrop =
    slide.mode === 'image' && mobile && Boolean(slide.mobileImageUrl);

  /**
   * The widths the server rendered for whichever crop is on screen.
   *
   * Absent for an older payload (the storefront cache key carries no version,
   * so a deploy serves entries without the field until it turns over) and for a
   * slide with no image. In that case the hero falls back to exactly what it
   * did before: one file, unoptimized.
   */
  const heroSrcSet =
    slide.mode === 'image'
      ? usingMobileCrop
        ? slide.mobileImageSrcSet
        : slide.imageSrcSet
      : null;
  const hasSrcSet = Boolean(heroSrcSet && Object.keys(heroSrcSet).length > 0);

  /*
   * Admin-chosen copy colours.
   *
   * Each is spread in conditionally rather than written as
   * `color: slide.eyebrowColor ?? 'var(--mr-...)'`. The `??` form looks
   * equivalent but is not: it restates the current colour as a literal in this
   * file, so the day the theme moves the eyebrow off `rgba(238,230,209,.6)` or
   * the headline off `--mr-cream-100`, every slide with no colour set silently
   * keeps the OLD one. Spreading nothing leaves the existing declaration
   * untouched and the cascade is still the single source of truth — which
   * matters most here, because "nothing set" is every slide in production
   * until an admin opens a picker.
   */
  const eyebrowColor = safeHexColor(slide.eyebrowColor);
  const headlineColor = safeHexColor(slide.headlineColor);
  const subColor = safeHexColor(slide.subColor);
  const taglineColor = safeHexColor(slide.taglineColor);

  /*
   * The CTA pair is all-or-nothing.
   *
   * The pill is a coordinated set — cream fill, ink label, ink hover sweep —
   * and half of it is how an admin makes an invisible button: pick a cream-ish
   * fill and the ink label survives, pick an ink-ish fill and the ink label
   * vanishes into it; set only the label colour and the same trap runs the
   * other way on the cream fill. Neither picker can be judged on its own, and
   * the dashboard shows both, so requiring both costs one extra click and
   * removes the entire failure mode. One alone falls back to today's pill.
   */
  const ctaBg = safeHexColor(slide.ctaBgColor);
  const ctaFg = safeHexColor(slide.ctaTextColor);
  const ctaColors = ctaBg && ctaFg ? { bg: ctaBg, fg: ctaFg } : null;

  /*
   * `.mr-hero-cta` inverts on hover by gliding a `--sweep-color` panel (ink)
   * under a label that a CSS rule turns cream. An inline `color` beats that
   * rule, so a custom label colour would sit on the ink panel whatever it is —
   * a dark custom label would disappear on hover. Pointing the sweep at the
   * chosen FILL keeps the panel invisible instead: the hover animation still
   * runs, it just no longer changes anything, and the pair the admin picked is
   * legible in every state. Restoring a real inverted sweep needs a rule in
   * `app/styles/mr-tokens.css`, which another change owns right now; it is
   * called out in the PR as a follow-up.
   */
  const ctaStyle = ctaColors
    ? ({
        background: ctaColors.bg,
        borderColor: ctaColors.bg,
        color: ctaColors.fg,
        ['--sweep-color' as string]: ctaColors.bg,
      } as React.CSSProperties)
    : undefined;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Background */}
      {slide.mode === 'image' ? (
        heroSrc ? (
          <Image
            key={heroSrc}
            src={heroSrc}
            alt={slide.imageAlt}
            fill
            priority
            sizes="100vw"
            /*
             * A loader when the server sent widths, `unoptimized` when it did
             * not — never both, because a loader is ignored while unoptimized
             * is set and the hero would silently keep serving one file.
             *
             * The loader is what produces a real `srcset` without Next
             * proxying anything, which is how this avoids depending on the
             * deployed imgproxy host being in `remotePatterns` (#11).
             */
            {...(hasSrcSet
              ? { loader: heroImageLoader(heroSrcSet) }
              : { unoptimized: true })}
            className="mr-hero-drift"
            style={{
              objectFit: 'cover',
              objectPosition: usingMobileCrop ? '50% 50%' : '62% 50%',
            }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: slide.background }} />
        )
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: slide.background }}>
          <div
            className="mr-hero-drift"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: mobile ? 'center' : 'flex-end',
              paddingRight: mobile ? 0 : '8%',
              transformOrigin: '50% 55%',
              opacity: 0.9,
            }}
          >
            <div style={{ transform: `scale(${mobile ? 1.8 : 2.6})` }}>
              <BottleSVG
                bottle={slide.bottle as Parameters<typeof BottleSVG>[0]['bottle']}
                cap={slide.cap as Parameters<typeof BottleSVG>[0]['cap']}
              />
            </div>
          </div>
        </div>
      )}

      {/* Scrims */}
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 240, pointerEvents: 'none', background: 'linear-gradient(to bottom,rgba(11,11,11,.55),transparent)' }} />
      <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 280, pointerEvents: 'none', background: 'linear-gradient(to bottom,transparent,rgba(11,11,11,.4) 50%,rgba(11,11,11,.65) 100%)' }} />

      {/* Copy */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: mobile ? 0 : '40%',
          bottom: mobile ? 112 : 130,
          padding: mobile ? '0 24px' : '0 60px',
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'rgba(238,230,209,0.6)',
            ...(eyebrowColor ? { color: eyebrowColor } : {}),
            marginBottom: 16,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay}ms`,
          }}
        >
          {slide.eyebrow}
        </div>
        <h1
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 400,
            fontSize: mobile ? 'clamp(40px,11vw,64px)' : 'clamp(56px,7vw,96px)',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            color: 'var(--mr-cream-100)',
            ...(headlineColor ? { color: headlineColor } : {}),
            /* The shadow stays either way — it is what separates the copy from
               a busy photograph, and dropping it with a colour set would make
               "pick a colour" quietly also mean "lose the lift". */
            textShadow: '0 2px 24px rgba(0,0,0,0.35)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 80}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 80}ms`,
          }}
        >
          {slide.headline}
        </h1>
        <h2
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: mobile ? 'clamp(28px,8vw,44px)' : 'clamp(36px,4.5vw,60px)',
            lineHeight: 0.95,
            letterSpacing: '-0.015em',
            margin: '0 0 20px',
            color: 'var(--mr-gold-300)',
            ...(subColor ? { color: subColor } : {}),
            textShadow: '0 2px 16px rgba(0,0,0,0.3)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 160}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 160}ms`,
          }}
        >
          {slide.sub}
        </h2>
        <p
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontSize: mobile ? 15 : 18,
            color: 'rgba(246,242,233,0.6)',
            ...(taglineColor ? { color: taglineColor } : {}),
            margin: '0 0 32px',
            maxWidth: 400,
            opacity: mounted ? 1 : 0,
            transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 260}ms`,
          }}
        >
          {slide.tagline}
        </p>
        {isActive && slide.ctaLabel && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(10px)',
              transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 360}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 360}ms`,
            }}
          >
            {/*
              Same button either way. These two branches used to render
              different things — a solid pill when a link was set, an OUTLINED
              sweep button when it was not — so whether the hero CTA looked
              filled or hollow depended on a field the admin may not even have
              realised was empty. Only the behaviour differs now (navigate vs
              scroll to the products); the appearance does not.
            */}
            {slide.ctaHref ? (
              <a href={slide.ctaHref} className="mr-hero-cta" style={ctaStyle}>
                {/* Wrapped, not bare text. `.mr-hero-cta::before` is a positioned
                    z-index:0 panel, and CSS paints positioned descendants ABOVE an
                    element's own inline content — so an unwrapped label is covered
                    by the sweep the instant it glides in. Same reason Button.tsx
                    wraps its children. */}
                <span>{slide.ctaLabel}</span>
              </a>
            ) : (
              <button type="button" className="mr-hero-cta" style={ctaStyle} onClick={onShop}>
                <span>{slide.ctaLabel}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

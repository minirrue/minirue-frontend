'use client';

import React from 'react';
import { preload } from 'react-dom';
import Image, { getImageProps } from 'next/image';
import BottleSVG from '@/components/ui/BottleSVG';
import { heroImageLoader } from '@/lib/images/hero-loader';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';

/**
 * A hero slide's video (backend#89): muted, looping, inline, and running only
 * while its slide is the one on screen.
 *
 * Muted because browsers refuse to autoplay anything else. Only the ACTIVE
 * slide loads or plays: the carousel mounts every slide, and #7 measured this
 * storefront as bandwidth-bound, so a clip behind a slide nobody can see must
 * cost nothing until that slide comes round.
 *
 * ## The source is assigned once, imperatively — never as a JSX prop
 *
 * Measured in real Chrome against a production build, five runs each: a plain
 * `<video src autoplay muted>` in static HTML made exactly one request every
 * time, while the same element created by React with `src` as a prop made a
 * second, cancelled request for the clip in three runs of five (up to 3.4 MB of
 * a 6.4 MB file before the abort). React sets `src` while it is still
 * assembling the element, so the browser starts loading before the element is
 * settled and then starts again.
 *
 * So the element renders with no source, and the effect below sets it a single
 * time when the slide is active — the same one assignment the plain page does.
 * An inactive slide and a server render have nothing to fetch, and the effect
 * checks the motion preference itself before loading (see below). The poster
 * paints in the meantime and is what LCP measures.
 *
 * `play()` is called explicitly because there is no `autoplay` attribute; its
 * promise is caught, since a browser that declines (data saver, low-power mode)
 * should simply leave the poster up.
 */
function HeroVideo({
  src,
  poster,
  active,
  label,
  objectPosition,
}: {
  src: string;
  poster: string | null;
  active: boolean;
  label: string;
  objectPosition: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active) {
      el.pause();
      return;
    }
    /*
     * Ask the browser directly, not the hook. During hydration React answers
     * `usePrefersReducedMotion` with its SERVER snapshot (motion allowed), so
     * this component mounts and this effect runs before the real preference
     * re-renders it away — measured: a reduced-motion visitor downloaded the
     * clip anyway. The media query at this moment is the truth.
     */
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.muted = true;
    if (el.getAttribute('src') !== src) {
      el.preload = 'auto';
      el.src = src;
    }
    void el.play()?.catch(() => {});
  }, [active, src]);

  return (
    <video
      ref={ref}
      key={src}
      poster={poster ?? undefined}
      aria-label={label}
      muted
      loop
      playsInline
      preload="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition,
      }}
    />
  );
}

/**
 * The phone breakpoint, as CSS. It must say exactly what `useBreakpoint` says
 * (`innerWidth < 640`), or a 639px window would get one crop from the media
 * query and the other from JavaScript.
 */
const PHONE_MEDIA = '(max-width: 639.98px)';
const DESKTOP_MEDIA = '(min-width: 640px)';

/**
 * A loader when the server sent widths, `unoptimized` when it did not — never
 * both, for the reason spelled out on the single-image branch below (and
 * pinned by hero-srcset.test.ts).
 */
function heroImageSource(srcSet: Record<string, string> | null | undefined) {
  const hasWidths = Boolean(srcSet && Object.keys(srcSet).length > 0);
  return hasWidths ? { loader: heroImageLoader(srcSet) } : { unoptimized: true };
}

/**
 * A photo slide with a separate phone crop, chosen by the BROWSER (#11).
 *
 * `mobile` comes from `useBreakpoint`, which reads `window.innerWidth` in an
 * effect — so on the server, and on the first client render, every visitor is
 * a phone. The server HTML therefore carried the portrait crop and preloaded
 * it, and on a desktop the landscape crop only replaced it after hydration.
 * Measured on minirueshop.com at 1440x900: the 401 KB phone crop downloaded
 * first, and the 439 KB desktop image — the one that is actually the LCP —
 * could not even be requested until the JavaScript had run.
 *
 * `<picture>` moves the decision to the HTML: each crop sits behind a media
 * query, the browser fetches only the one that matches, and it can start
 * before a line of JavaScript. The preloads carry the same media queries so
 * the early fetch is also only ever the right crop.
 *
 * The object-position differs per crop (the landscape frame favours the right
 * where the product sits), so it is a media query too rather than an inline
 * style that would again depend on `mobile`.
 */
function ArtDirectedHeroImage({
  alt,
  desktopSrc,
  desktopSrcSet,
  mobileSrc,
  mobileSrcSet,
}: {
  alt: string;
  desktopSrc: string;
  desktopSrcSet: Record<string, string> | null | undefined;
  mobileSrc: string;
  mobileSrcSet: Record<string, string> | null | undefined;
}) {
  const shared = { alt, fill: true, sizes: '100vw' } as const;
  const desktop = getImageProps({ ...shared, src: desktopSrc, ...heroImageSource(desktopSrcSet) }).props;
  const phone = getImageProps({ ...shared, src: mobileSrc, ...heroImageSource(mobileSrcSet) }).props;

  // What `priority` did for the single image, once per crop and gated by media.
  preload(desktop.src, {
    as: 'image',
    fetchPriority: 'high',
    media: DESKTOP_MEDIA,
    ...(desktop.srcSet ? { imageSrcSet: desktop.srcSet, imageSizes: desktop.sizes } : {}),
  });
  preload(phone.src, {
    as: 'image',
    fetchPriority: 'high',
    media: PHONE_MEDIA,
    ...(phone.srcSet ? { imageSrcSet: phone.srcSet, imageSizes: phone.sizes } : {}),
  });

  return (
    <picture>
      <source
        media={PHONE_MEDIA}
        srcSet={phone.srcSet ?? phone.src}
        sizes={phone.srcSet ? phone.sizes : undefined}
      />
      {/* A plain <img> on purpose: next/image cannot render <picture>, and
          getImageProps is Next's documented art-direction path — every
          attribute here still comes from it. */}
      <img
        {...desktop}
        alt={alt}
        fetchPriority="high"
        loading="eager"
        className="mr-hero-drift object-[62%_50%] max-sm:object-[50%_50%]"
        style={{ ...desktop.style, objectFit: 'cover' }}
      />
    </picture>
  );
}

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

  // The hero is content, not decoration, so it always has alt text (#155). An
  // admin who leaves `imageAlt` blank gets the slide's headline, then the brand.
  const heroAlt =
    slide.imageAlt?.trim() || slide.headline?.replace(/\s+/g, ' ').trim() || 'MiniRue';

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
   * Is the crop on screen a video (backend#89)? Follows exactly the fallback
   * `heroSrc` takes: a phone with no mobile crop shows the desktop media, so it
   * must also take the desktop kind and poster, not the mobile ones.
   */
  const reduceMotion = usePrefersReducedMotion();
  const heroKind =
    slide.mode === 'image'
      ? (usingMobileCrop ? slide.mobileMediaKind : slide.mediaKind) ?? 'image'
      : 'image';
  const heroPoster =
    (usingMobileCrop ? slide.mobilePosterUrl : slide.posterUrl) ?? null;
  const heroObjectPosition = usingMobileCrop ? '50% 50%' : '62% 50%';

  /*
   * Both crops are photos: let the browser pick between them (see
   * ArtDirectedHeroImage). Any slide with a video on either side keeps the
   * `mobile`-driven path — a video needs JavaScript to play anyway, and the
   * poster/photo fallbacks between the two kinds are decided there.
   */
  const artDirected =
    slide.mode === 'image' && slide.imageUrl && slide.mobileImageUrl &&
    (slide.mediaKind ?? 'image') === 'image' &&
    (slide.mobileMediaKind ?? 'image') === 'image'
      ? {
          desktopSrc: slide.imageUrl,
          desktopSrcSet: slide.imageSrcSet,
          mobileSrc: slide.mobileImageUrl,
          mobileSrcSet: slide.mobileImageSrcSet,
        }
      : null;

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
        artDirected ? (
          <ArtDirectedHeroImage key={artDirected.desktopSrc} alt={heroAlt} {...artDirected} />
        ) : heroSrc && heroKind === 'video' ? (
          reduceMotion ? (
            /*
             * Asked for less motion: the poster, still, and no video element at
             * all. With no poster there is nothing still to show, so it is the
             * slide's background colour.
             */
            heroPoster ? (
              <Image
                key={heroPoster}
                src={heroPoster}
                alt={heroAlt}
                fill
                priority
                sizes="100vw"
                // A poster is one file with no widths; the loader hands it back
                // untouched, which keeps it off Next's optimizer exactly like
                // every other hero image (see hero-srcset.test.ts).
                loader={heroImageLoader(null)}
                style={{ objectFit: 'cover', objectPosition: heroObjectPosition }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: slide.background }} />
            )
          ) : (
            <HeroVideo
              src={heroSrc}
              poster={heroPoster}
              active={isActive}
              label={heroAlt}
              objectPosition={heroObjectPosition}
            />
          )
        ) : heroSrc ? (
          <Image
            key={heroSrc}
            src={heroSrc}
            alt={heroAlt}
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

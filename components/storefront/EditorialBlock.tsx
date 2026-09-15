/* eslint-disable react-hooks/refs -- False positive on `useScrollReveal`.
 *
 * The hook returns `{ ref, style }` (lib/motion/hooks.ts). Handing that `ref`
 * to a DOM element — `ref={head.ref}` — is the documented way to use a ref
 * object, and spreading `style` next to it reads a plain CSSProperties value.
 * The rule cannot tell a property NAMED `ref` from a `.current` dereference, so
 * it reports every reveal-animated element in this file.
 *
 * Disabled for the file rather than the rule, because the same rule caught a
 * real bug elsewhere in this repo: ChatButton derived its drag cursor from
 * `dragStart.current` during render, which is not reactive.
 */
'use client';

import React from 'react';
import BottleSVG from '@/components/ui/BottleSVG';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';
import { useScrollReveal } from '@/lib/motion/hooks';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import type { ResolvedSection } from '@/lib/api/storefront';

type JournalSection = Extract<ResolvedSection, { type: 'journal' }>;

export default function EditorialBlock({ section }: { section: JournalSection }) {
  const photo = useScrollReveal({ from: { y: 28, opacity: 0, scale: 0.97 } });
  const copy = useScrollReveal({ from: { y: 18, opacity: 0, scale: 1 }, delay: 80 });
  const { mobile } = useBreakpoint();

  return (
    <section
      data-mr-surface="ink"
      style={{
        background: 'var(--mr-ink-900)',
        color: 'var(--mr-cream-100)',
        padding: 'clamp(64px,10vw,120px) var(--mr-gutter)',
        marginTop: 48,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: mobile ? 48 : 80,
          alignItems: 'center',
        }}
      >
        <div
          ref={photo.ref}
          style={{
            ...photo.style,
            order: section.imageSide === 'right' ? 2 : 1,
            aspectRatio: mobile ? '4/3' : '3/4',
            background: 'linear-gradient(135deg,#3B0001,#670003 50%,#1A0000)',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--mr-radius-lg)',
            boxShadow: 'var(--mr-shadow-crimson)',
          }}
        >
          {section.imageUrl && section.mediaKind === 'video' ? (
            /*
             * A journal video (backend#89). Not autoplaying, on purpose: this
             * block sits below the fold and is not the LCP element, and #7
             * measured the product page as bandwidth-bound — a clip that starts
             * downloading on its own competes with everything above it. The
             * shopper presses play.
             *
             * `preload="none"` when there is a poster, so the page pays zero
             * video bytes until then. Without one, `metadata` fetches just
             * enough for the browser to paint a first frame instead of an empty
             * crimson box.
             *
             * No `mr-hero-drift` — the slow drift that suits a still would move
             * the video's own controls out from under the pointer.
             */
            <video
              src={section.imageUrl}
              poster={section.posterUrl ?? undefined}
              controls
              playsInline
              preload={section.posterUrl ? 'none' : 'metadata'}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : section.imageUrl ? (
            // Never a bare image tag — an editorial photograph is swapped from
            // the dashboard's storefront editor, landing on a brand-new
            // uuid-suffixed key whose first request is a guaranteed cold miss.
            // This is a full-bleed hero: a failed load here is not a small
            // broken square, it is the whole block (owner, 2026-07-31).
            <UploadPreviewImage
              src={section.imageUrl}
              alt={section.title || 'MiniRue'}
              className="mr-hero-drift"
              fill
              /*
                The widest picture on the storefront that is not the hero, so
                `sizes` is worth deriving rather than guessing (#11).
                Geometry: this `<section>` is full-bleed with `var(--mr-gutter)`
                = clamp(20px, 4vw, 48px) of padding; the grid inside caps at
                1100px and splits into two equal columns with an 80px gap above
                the 640px breakpoint (`useBreakpoint`), one column below it.

                  390px viewport → gutter 20 → row 350 → 1 column →  350px
                 1440px viewport → gutter 48 → row min(1100,1344)=1100
                                 → (1100 − 80) / 2 =                  510px

                The 1100px cap is reached at ≈1196px of viewport, so between the
                breakpoint and there the column is (0.92·vw − 80)/2, which 46vw
                bounds from above at every width. The first stop is set at 700px
                rather than 639px on purpose: the one/two-column switch is a JS
                measurement of `window.innerWidth` and this is a CSS media query
                on the viewport, and the two disagree by the scrollbar. Erring
                to the wide side of that seam costs a few KB in a 60px band;
                erring to the narrow side would ship a half-width image into a
                full-width box.
              */
              sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1196px) 46vw, 510px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div
              className="mr-hero-drift"
              style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', transformOrigin: '50% 55%',
              }}
            >
              <BottleSVG bottle="crimson" cap="cream" />
            </div>
          )}
          {section.badge && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                // Over a video the badge sits on top of the player; it must
                // never swallow a click meant for it.
                pointerEvents: 'none',
                fontFamily: 'Jost, sans-serif',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--mr-cream-100)',
                opacity: 0.6,
              }}
            >
              {section.badge}
            </div>
          )}
        </div>

        <div ref={copy.ref} style={{ ...copy.style, order: section.imageSide === 'right' ? 1 : 2 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mr-gold-300)', marginBottom: 20 }}>
            {section.eyebrow}
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400, fontSize: 'clamp(32px,5vw,52px)', lineHeight: 1.08, letterSpacing: '-0.01em', margin: '0 0 28px' }}>
            {section.title}
          </h2>
          <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 16, lineHeight: 1.65, color: 'var(--mr-cream-200)', opacity: 0.85, maxWidth: 420, margin: '0 0 36px' }}>
            {section.body}
          </p>
          {/*
            One button, whether or not a link was given — matching SlideContent.
            Before, this block appended an arrow and rendered a different
            component in the no-link case, so the same label typed into two
            places in the dashboard produced two different-looking buttons. The
            label is the only thing an admin controls, so it is the only thing
            that should vary.
          */}
          {section.ctaLabel &&
            (section.ctaHref ? (
              <a href={section.ctaHref} className="mr-hero-cta">
                {/* Wrapped, not bare text. `.mr-hero-cta::before` is a positioned
                    z-index:0 panel, and CSS paints positioned descendants ABOVE an
                    element's own inline content — so an unwrapped label is covered
                    by the sweep the instant it glides in. Same reason Button.tsx
                    wraps its children. */}
                <span>{section.ctaLabel}</span>
              </a>
            ) : (
              <span className="mr-hero-cta" role="presentation">
                <span>{section.ctaLabel}</span>
              </span>
            ))}
        </div>
      </div>
    </section>
  );
}

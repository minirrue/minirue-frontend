'use client';

import React from 'react';
import SlideContent from './SlideContent';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';

interface HeroProps {
  slides: ResolvedHeroSlide[];
  autoplayMs: number;
  ariaLabel?: string;
  scrollCueLabel?: string | null;
  onShop?: () => void;
  /**
   * Pixels of the first screen taken by whatever sits directly below the hero
   * and belongs to it — today the ribbon that so often follows it.
   *
   * The hero gives up exactly this many so the PAIR fills one viewport. Without
   * it the hero is a viewport tall and the ribbon pushes the fold down, which
   * is the "I can see the website under the hero" report.
   */
  belowOffset?: number;
}

export default function Hero({
  slides,
  autoplayMs,
  ariaLabel = 'Featured products carousel',
  scrollCueLabel,
  onShop,
  belowOffset = 0,
}: HeroProps) {
  const { mobile } = useBreakpoint();
  const [current, setCurrent] = React.useState(0);
  const [prev, setPrev] = React.useState<number | null>(null);
  const [animating, setAnimating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const timerRef = React.useRef(0);
  const startRef = React.useRef(0);
  const progressRef = React.useRef(0);

  // A live update (SSE/poll) can swap in a shorter `slides` array while
  // `current` (and `prev`) still hold indices from the old, longer array.
  // Clamp to the current bounds everywhere an index is read or advanced so
  // a shrink can never produce `slides[current] === undefined` — that used
  // to throw in SlideContent and white-screen the shop. Every consumer of
  // "the current slide index" below reads `safeIndex`, never raw `current`,
  // so the autoplay timer, keyboard nav, and dot navigation stay consistent
  // with each other after a shrink.
  const safeIndex = slides.length === 0 ? 0 : Math.min(current, slides.length - 1);
  const safePrev =
    prev !== null && slides.length > 0 ? Math.min(prev, slides.length - 1) : null;

  const goTo = React.useCallback(
    (idx: number) => {
      if (animating || idx === safeIndex) return;
      setPrev(safeIndex);
      setCurrent(idx);
      setAnimating(true);
      setProgress(0);
      progressRef.current = 0;
      setTimeout(() => { setPrev(null); setAnimating(false); }, 650);
    },
    [animating, safeIndex],
  );

  // Progress ticker
  React.useEffect(() => {
    if (paused || slides.length === 0) return;
    const tick = (now: number) => {
      if (paused) return;
      const elapsed = now - startRef.current;
      const p = Math.min(1, elapsed / autoplayMs);
      progressRef.current = p;
      setProgress(p);
      if (p >= 1) {
        goTo((safeIndex + 1) % slides.length);
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };
    startRef.current = performance.now() - progressRef.current * autoplayMs;
    timerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timerRef.current);
  }, [safeIndex, paused, goTo, autoplayMs, slides.length]);

  // Keyboard navigation
  React.useEffect(() => {
    if (slides.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  goTo((safeIndex - 1 + slides.length) % slides.length);
      if (e.key === 'ArrowRight') goTo((safeIndex + 1) % slides.length);
      if (e.key === 'Home') goTo(0);
      if (e.key === 'End')  goTo(slides.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [safeIndex, goTo, slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[safeIndex];
  const prevSlide = safePrev !== null ? slides[safePrev] : null;

  return (
    <section
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: 'relative',
        /*
         * svh, NOT dvh — this is the whole "page expands as you scroll" bug on
         * mobile (reported 2026-08-23), and an earlier pass fixed it in the
         * wrong direction.
         *
         *   vh  = LARGE viewport (chrome hidden). Constant.
         *   svh = SMALL viewport (chrome shown).  Constant.
         *   dvh = DYNAMIC. Re-resolves live as the URL bar collapses.
         *
         * `dvh` is the only one of the three that changes mid-scroll, so
         * putting it on an in-flow element makes that element — and the page
         * under it — literally grow as the toolbar hides. On this banner, which
         * sits at the top of every page, that is the most visible possible
         * place for it. `svh` is stable AND small, so the hero never reflows
         * and never gets clipped by chrome that is still on screen.
         *
         * dvh is still right for FIXED overlays (the chat panel, the nav and
         * search sheets) — those must fit the visible area and contribute no
         * page height. Do not sweep those to svh.
         */
        /*
         * A full viewport on both, and the ribbon counts as part of it.
         *
         * Mobile was 80svh, so a strip of the page below showed under the hero
         * on first load — the owner's report was seeing "the website under the
         * hero". Desktop was capped at 980px, so on a tall screen the hero
         * stopped short of the fold for the same reason.
         *
         * `belowOffset` is the height of whatever sits directly beneath the
         * hero and belongs to the same first screen — today the ribbon. The
         * hero gives up exactly that many pixels so the PAIR is one viewport
         * rather than the hero being one viewport and the ribbon pushing the
         * fold down.
         *
         * svh throughout, per the note above: it is the only unit that is both
         * stable and small, so the hero neither reflows as the URL bar
         * collapses nor hides behind chrome that is still on screen.
         */
        height: `calc(100svh - ${belowOffset}px)`,
        minHeight: mobile ? 520 : 680,
        background: '#0B0B0B',
        color: 'var(--mr-cream-100)',
        overflow: 'hidden',
        // -116 = -(announcement bar 34 + header 82). Hero extends behind both so transparent header reveals hero (not page-sheet cream).
        marginTop: -116,
      }}
    >
      {/* Previous slide exits left */}
      {prevSlide && (
        <div
          key={`prev-${prevSlide.id}`}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            transform: 'translateX(-100%)',
            transition: 'transform 650ms cubic-bezier(0.16,1,0.3,1)',
            willChange: 'transform',
          }}
        >
          <SlideContent slide={prevSlide} mobile={mobile} isActive={false} />
        </div>
      )}

      {/* Current slide */}
      <div
        key={`cur-${slide.id}`}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          animation: animating ? 'hero-slide-in 650ms cubic-bezier(0.16,1,0.3,1) both' : 'none',
          willChange: 'transform',
        }}
      >
        <SlideContent slide={slide} mobile={mobile} isActive key={slide.id} onShop={onShop} />
      </div>

      {/* Progress indicators */}
      <div
        style={{
          position: 'absolute',
          bottom: mobile ? 56 : 72,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          zIndex: 10,
          /*
           * On a phone the floating chat button (bottom-right, ~56px) sat on top
           * of the last indicator bar (frontend#82, measured on Pixel 5). The
           * row now ends before it; desktop keeps its centred, short bars.
           */
          padding: mobile ? '0 88px 0 24px' : '0 24px',
        }}
      >
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              height: 3,
              flex: mobile ? '1 1 0' : '0 0 80px',
              maxWidth: 100,
              background: 'rgba(253,251,245,0.25)',
              borderRadius: 2,
              border: 0,
              cursor: 'pointer',
              overflow: 'hidden',
              padding: 0,
              transition: 'background 200ms',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 2,
                background: 'var(--mr-cream-100)',
                width: i === current ? `${progress * 100}%` : i < current ? '100%' : '0%',
                transition: i === current ? 'none' : 'width 300ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          </button>
        ))}
      </div>

      {/* Scroll cue — far right, vertical rail, fast downward pillar sweep */}
      {scrollCueLabel && (
        <div
          style={{
            position: 'absolute',
            /*
             * On a phone the slide indicators stretch the full width at
             * `bottom: 56`, and this cue grows ~115px upward from its own
             * bottom — so at `bottom: 32` its rail ran straight through them
             * (frontend#82, measured on iPhone SE and Pixel 5). Lifted to sit
             * just above the indicator row there (56 + 3px bar + 14px gap);
             * measured clear of the headline and CTA, which are left-aligned.
             * Desktop indicators are short and centred, so its spot is kept.
             */
            bottom: mobile ? 73 : 32,
            right: mobile ? 20 : 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            zIndex: 10,
            animation: 'mr-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '1200ms',
          }}
        >
          <div
            style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 9,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: 'rgba(238,230,209,0.55)',
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
            }}
          >
            {scrollCueLabel}
          </div>
          {/* Pillar track — sweeping bar animates scaleY 0→1 top-down, fast loop */}
          <div
            style={{
              width: 1,
              height: 56,
              position: 'relative',
              background: 'rgba(238,230,209,0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(238,230,209,0.85), rgba(238,230,209,0.1))',
                animation: 'mr-pillar-sweep 900ms cubic-bezier(0.4,0,0.2,1) infinite',
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

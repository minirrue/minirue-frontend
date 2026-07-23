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
}

export default function Hero({
  slides,
  autoplayMs,
  ariaLabel = 'Featured products carousel',
  scrollCueLabel,
  onShop,
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
        height: mobile ? '80vh' : 'min(100vh, 980px)',
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
          padding: '0 24px',
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
            bottom: 32,
            right: 40,
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

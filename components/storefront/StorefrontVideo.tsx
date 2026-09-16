'use client';

import React from 'react';
import { preload as preloadResource } from 'react-dom';
import { controlLabel, ringOffset, type PlayerStatus } from '@/lib/media/storefront-video';

/**
 * Every storefront video — hero slides, journal blocks, product galleries (#135).
 *
 * Modelled on apple.com's inline media: muted, inline, starting on its own when
 * it is on screen, and no chrome at all except one small round button in the
 * bottom-right corner. A thin ring around that button fills clockwise with
 * playback; the icon in its centre is pause while playing, play while paused,
 * replay once a play-once clip has finished.
 *
 * ## Built, not adopted
 *
 * Measured with esbuild (minified / gzipped, React external), 2026-09-14:
 *
 *     media-chrome 4.19.2 — controller + play button only    84.7 KB / 22.9 KB
 *     media-chrome/react 4.19.2                               190 KB  / 45.7 KB
 *     @vidstack/react 1.15.6 — player, provider, play button  312 KB  / 98.1 KB
 *
 * Neither ships a progress ring, so either one would still need this SVG on
 * top — and #76 measured JavaScript as what the LCP image competes with. This
 * file plus its helper is a couple of KB. Nothing was copied from either
 * library. Geometry was read off apple.com's own inline-media stylesheet (a
 * 36px disc, 16px from the edge, a translucent fill, a `.95` press scale, an
 * 8-step loading spinner) — measurements only, no code. The replay glyph is
 * Lucide's `rotate-ccw` (ISC licence, lucide.dev).
 *
 * ## Bytes
 *
 * - **Poster first.** The element renders with `preload="none"` and NO source,
 *   so server HTML and every off-screen player cost nothing but the poster.
 * - **Source assigned once, imperatively** (lesson #91): React setting `src`
 *   while assembling the element made Chrome start and then cancel a second
 *   download of the clip. The effect sets it a single time, guarded.
 * - **Loads near, plays in view.** One IntersectionObserver starts buffering
 *   half a viewport ahead; a second plays at a quarter visible and pauses when
 *   the player leaves.
 * - **Reduced motion never starts itself** and never downloads a byte: poster
 *   plus a play button. The preference is read from `matchMedia` at the moment
 *   it matters, not from a hook, which answers with the server snapshot during
 *   hydration (lesson #92).
 *
 * ## The one control
 *
 * The ring is drawn by `requestAnimationFrame` straight onto the SVG while the
 * video plays — never through React state, which would re-render sixty times a
 * second for a line. The video itself has no click handler and no `controls`:
 * a tap on the picture does nothing (#81); only the button acts. A shopper's
 * pause is remembered, so scrolling away and back does not restart a clip they
 * stopped.
 */

const RADIUS = 16.25;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Start buffering this far before the player reaches the viewport. */
const NEAR_MARGIN = '50% 0px';
/** Visible fraction at which the player starts, and below which it pauses. */
const IN_VIEW = 0.25;

type Intent = 'auto' | 'paused' | 'played';

export interface StorefrontVideoProps {
  src: string;
  poster?: string | null;
  /** Describes the footage, for the video element. */
  label: string;
  /** False keeps it unloaded and paused — a hero slide that is not on screen. */
  active?: boolean;
  /** Loop (hero), or play once and offer replay (journal, product). */
  loop?: boolean;
  objectPosition?: string;
  /** Preload the poster at high priority when it is the page's LCP candidate. */
  preloadPoster?: boolean;
  /** Where the button sits, when a surface already has something in the corner. */
  controlStyle?: React.CSSProperties;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export default function StorefrontVideo({
  src,
  poster,
  label,
  active = true,
  loop = false,
  objectPosition = '50% 50%',
  preloadPoster = false,
  controlStyle,
}: StorefrontVideoProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const arcRef = React.useRef<SVGCircleElement>(null);
  const intent = React.useRef<Intent>('auto');
  const [status, setStatus] = React.useState<PlayerStatus>('paused');
  const [loading, setLoading] = React.useState(false);
  const [near, setNear] = React.useState(false);
  const [inView, setInView] = React.useState(false);

  if (preloadPoster && poster) preloadResource(poster, { as: 'image', fetchPriority: 'high' });

  const load = React.useCallback(() => {
    const el = videoRef.current;
    if (el && el.getAttribute('src') !== src) {
      el.preload = 'auto';
      el.src = src;
    }
  }, [src]);

  const start = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    load();
    el.muted = true;
    if (el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setLoading(true);
    // A browser that declines (data saver, low-power mode) leaves the poster up
    // and the play button offered.
    el.play()?.catch(() => {
      setLoading(false);
      setStatus(el.ended ? 'ended' : 'paused');
    });
  }, [load]);

  // Near / in view.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const nearObserver = new IntersectionObserver(
      (entries) => {
        // Ratio, not just isIntersecting: a gallery slide parked against the
        // strip's clipped edge "intersects" with zero area, and would load
        // before anyone swiped to it (measured).
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio > 0)) setNear(true);
      },
      { rootMargin: NEAR_MARGIN },
    );
    const viewObserver = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (e) setInView(e.isIntersecting && e.intersectionRatio >= IN_VIEW - 0.01);
      },
      { threshold: [0, IN_VIEW] },
    );
    nearObserver.observe(el);
    viewObserver.observe(el);
    return () => {
      nearObserver.disconnect();
      viewObserver.disconnect();
    };
  }, []);

  // Buffer ahead of arrival — unless the shopper asked for less motion.
  React.useEffect(() => {
    if (active && near && !prefersReducedMotion()) load();
  }, [active, near, load]);

  // Play on screen, pause off it.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!active || !inView) {
      // Its 'pause' event clears the loading ring.
      el.pause();
      return;
    }
    const allowed = intent.current === 'played' || (intent.current === 'auto' && !prefersReducedMotion());
    if (allowed && !el.ended) start();
  }, [active, inView, start]);

  // Mirror the element, and draw the ring.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let frame = 0;
    const draw = () => {
      const arc = arcRef.current;
      if (arc) arc.style.strokeDashoffset = String(el.ended ? 0 : ringOffset(el.currentTime, el.duration, CIRCUMFERENCE));
    };
    const tick = () => {
      draw();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      draw();
    };
    const onPlay = () => setStatus('playing');
    const onPlaying = () => {
      setStatus('playing');
      setLoading(false);
      if (!frame) tick();
    };
    const onPause = () => {
      stop();
      setLoading(false);
      setStatus(el.ended ? 'ended' : 'paused');
    };
    const onEnded = () => {
      stop();
      setLoading(false);
      setStatus('ended');
    };
    const onWaiting = () => setLoading(true);
    const onError = () => {
      stop();
      setLoading(false);
      setStatus('paused');
    };
    const onSync = () => {
      if (!frame) draw();
    };
    const listeners: [string, () => void][] = [
      ['play', onPlay],
      ['playing', onPlaying],
      ['pause', onPause],
      ['ended', onEnded],
      ['waiting', onWaiting],
      ['error', onError],
      ['timeupdate', onSync],
      ['seeked', onSync],
      ['durationchange', onSync],
    ];
    for (const [type, fn] of listeners) el.addEventListener(type, fn);
    return () => {
      cancelAnimationFrame(frame);
      for (const [type, fn] of listeners) el.removeEventListener(type, fn);
    };
  }, []);

  const onToggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (status === 'playing') {
      intent.current = 'paused';
      el.pause();
      return;
    }
    if (status === 'ended') el.currentTime = 0;
    intent.current = 'played';
    start();
  };

  const fade = 'transition-opacity duration-150 ease-out motion-reduce:transition-none';

  return (
    <>
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        aria-label={label}
        muted
        loop={loop}
        playsInline
        preload="none"
        disablePictureInPicture
        disableRemotePlayback
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          display: 'block',
        }}
      />
      <button
        type="button"
        data-storefront-video-control=""
        aria-label={controlLabel(status)}
        onClick={onToggle}
        // 44px to hit, 36px to see.
        className="group absolute z-[3] grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 outline-none [-webkit-tap-highlight-color:transparent]"
        style={{
          right: 'max(12px, env(safe-area-inset-right))',
          bottom: 'max(12px, env(safe-area-inset-bottom))',
          ...controlStyle,
        }}
      >
        {/*
          Ink, translucent and blurred: the footage underneath is unknown, and
          the cream ring and icon have to read over a white sky and a black
          night alike. The blur is doing that job, not decorating.
        */}
        <span
          aria-hidden="true"
          className="relative block h-9 w-9 rounded-full bg-[rgba(11,11,11,0.42)] text-[var(--mr-cream-100)] shadow-[0_1px_10px_rgba(0,0,0,0.22)] backdrop-blur-md backdrop-saturate-150 transition-[background-color,transform] duration-150 ease-out group-hover:bg-[rgba(11,11,11,0.6)] group-active:scale-[0.94] group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--mr-gold-300)] motion-reduce:transition-none"
        >
          <svg viewBox="0 0 36 36" width="36" height="36" className="absolute inset-0" focusable="false">
            <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
            <circle
              ref={arcRef}
              data-ring-progress=""
              cx="18"
              cy="18"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE}
              transform="rotate(-90 18 18)"
              className={fade}
              style={{ opacity: loading ? 0 : 1 }}
            />
            <g fill="currentColor" className={fade} style={{ opacity: status === 'playing' ? 1 : 0 }}>
              <rect x="13.4" y="12.25" width="3.2" height="11.5" rx="1.1" />
              <rect x="19.4" y="12.25" width="3.2" height="11.5" rx="1.1" />
            </g>
            <path
              d="M15 12.9v10.2c0 .83.9 1.35 1.62.93l8.52-5.1a1.08 1.08 0 0 0 0-1.86l-8.52-5.1c-.72-.42-1.62.1-1.62.93z"
              fill="currentColor"
              className={fade}
              style={{ opacity: status === 'paused' ? 1 : 0 }}
            />
            {/* Lucide rotate-ccw (ISC), scaled into the 36-unit box. */}
            <g
              transform="translate(11 11) scale(0.5833)"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={fade}
              style={{ opacity: status === 'ended' ? 1 : 0 }}
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </g>
          </svg>
          {loading && (
            <svg
              data-ring-loading=""
              viewBox="0 0 36 36"
              width="36"
              height="36"
              className="absolute inset-0 motion-safe:animate-spin"
              focusable="false"
            >
              <circle
                cx="18"
                cy="18"
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE * 0.22} ${CIRCUMFERENCE}`}
                transform="rotate(-90 18 18)"
              />
            </svg>
          )}
        </span>
      </button>
    </>
  );
}

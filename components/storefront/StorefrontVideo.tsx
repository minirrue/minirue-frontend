'use client';

import React from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

const RING_RADIUS = 13;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function reducedMotionNow(): boolean {
  return Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches);
}

export function videoProgress(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
}

type PlaybackState = 'idle' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

interface StorefrontVideoProps {
  src: string;
  poster?: string | null;
  label: string;
  /** When supplied, the parent already owns visibility (for example a hero carousel). */
  active?: boolean;
  objectPosition?: string;
}

/**
 * Poster-first storefront video with one Apple-style control.
 *
 * The source is deliberately assigned to the settled DOM node, never rendered
 * in JSX. That avoids React's occasional start/cancel/restart media request and
 * leaves off-screen videos at zero bytes until they approach the viewport.
 */
export default function StorefrontVideo({
  src,
  poster,
  label,
  active,
  objectPosition = '50% 50%',
}: StorefrontVideoProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const progressRef = React.useRef<SVGCircleElement>(null);
  const frameRef = React.useRef(0);
  // A parent-supplied `active` is an immediate visibility hint (hero/gallery)
  // while IntersectionObserver remains the authority once it reports. A
  // standalone editorial player starts cold until the observer sees it.
  const [near, setNear] = React.useState(active !== undefined);
  const [inView, setInView] = React.useState(active !== undefined);
  const [state, setState] = React.useState<PlaybackState>('idle');
  const reduceMotion = usePrefersReducedMotion();

  const setRing = React.useCallback((progress: number) => {
    if (progressRef.current) {
      progressRef.current.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
    }
  }, []);

  const stopProgress = React.useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
  }, []);

  const runProgress = React.useCallback(() => {
    stopProgress();
    const draw = () => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) {
        frameRef.current = 0;
        return;
      }
      setRing(videoProgress(video.currentTime, video.duration));
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
  }, [setRing, stopProgress]);

  React.useEffect(() => stopProgress, [stopProgress]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        setNear(true);
        setInView(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const preloader = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: '400px 0px', threshold: 0 },
    );
    const visibility = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.25),
      { threshold: [0, 0.25, 0.75] },
    );
    preloader.observe(root);
    visibility.observe(root);
    return () => {
      preloader.disconnect();
      visibility.disconnect();
    };
  }, [active]);

  const parentActive = active ?? true;
  const shouldLoad = parentActive && near;
  const shouldPlay = parentActive && inView;

  const assignSource = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    if (video.getAttribute('src') !== src) {
      video.preload = 'metadata';
      video.src = src;
    }
    return video;
  }, [src]);

  React.useEffect(() => {
    // Read the query directly here as well as through the hook. During
    // hydration the hook must briefly expose its server snapshot (`false`),
    // but assigning a source in that window would download motion a visitor
    // explicitly asked not to receive.
    if (!shouldLoad || reducedMotionNow()) return;
    assignSource();
  }, [assignSource, reduceMotion, shouldLoad]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!shouldPlay || reducedMotionNow()) {
      video.pause();
      return;
    }

    const loaded = assignSource();
    if (!loaded) return;
    loaded.muted = true;
    void loaded.play()?.catch(() => setState('paused'));
  }, [assignSource, reduceMotion, shouldPlay]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video || state === 'error') return;
    if (!video.paused && !video.ended) {
      video.pause();
      return;
    }
    const loaded = assignSource();
    if (!loaded) return;
    if (loaded.ended || state === 'ended') {
      loaded.currentTime = 0;
      setRing(0);
    }
    loaded.muted = true;
    setState('buffering');
    void loaded.play()?.catch(() => setState('paused'));
  };

  const playing = state === 'playing' || state === 'buffering';
  const labelText =
    state === 'error'
      ? 'Video unavailable'
      : state === 'ended'
        ? 'Replay video'
        : playing
          ? 'Pause video'
          : 'Play video';

  return (
    <div ref={rootRef} data-storefront-video data-state={state} style={{ position: 'absolute', inset: 0 }}>
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        aria-label={label}
        muted
        playsInline
        preload="none"
        onPlaying={() => {
          setState('playing');
          runProgress();
        }}
        onPause={() => {
          stopProgress();
          setState((current) => (current === 'ended' || current === 'error' ? current : 'paused'));
        }}
        onWaiting={() => setState('buffering')}
        onCanPlay={() => setState((current) => (current === 'buffering' && videoRef.current?.paused ? 'paused' : current))}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (video) setRing(videoProgress(video.currentTime, video.duration));
        }}
        onEnded={() => {
          stopProgress();
          setRing(1);
          setState('ended');
        }}
        onError={() => {
          stopProgress();
          setState('error');
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          pointerEvents: 'none',
        }}
      />

      <button
        type="button"
        aria-label={labelText}
        disabled={state === 'error'}
        onClick={toggle}
        className="group absolute bottom-[max(16px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-[3] grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent p-0 text-[var(--mr-cream-100)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--mr-gold-300)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mr-ink-900)] disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className="absolute inset-1.5 rounded-full bg-[rgba(11,11,11,0.62)] shadow-[0_2px_14px_rgba(0,0,0,0.3)] backdrop-blur-sm transition-colors group-hover:bg-[rgba(11,11,11,0.78)]"
        />
        <svg aria-hidden="true" viewBox="0 0 32 32" className="absolute h-8 w-8 -rotate-90 overflow-visible">
          <circle cx="16" cy="16" r={RING_RADIUS} fill="none" stroke="rgba(238,230,209,.32)" strokeWidth="1.5" />
          <circle
            ref={progressRef}
            data-video-progress
            cx="16"
            cy="16"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH}
            style={{
              opacity: state === 'buffering' ? 0 : 1,
              transition: reduceMotion ? 'none' : 'stroke-dashoffset 120ms linear',
            }}
          />
          {state === 'buffering' && (
            <circle
              cx="16"
              cy="16"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={`18 ${RING_LENGTH - 18}`}
              style={{
                transformOrigin: '16px 16px',
                animation: reduceMotion ? undefined : 'mr-video-ring-spin 900ms linear infinite',
              }}
            />
          )}
        </svg>
        <span aria-hidden="true" className="relative z-[1] grid h-4 w-4 place-items-center">
          {state === 'ended' ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.8 5.1A5.3 5.3 0 1 0 13 10" />
              <path d="M10.2 4.8h3V1.9" />
            </svg>
          ) : playing ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current"><path d="M4.8 3.5h2.1v9H4.8zM9.1 3.5h2.1v9H9.1z" /></svg>
          ) : state === 'error' ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round"><path d="M5 5l6 6M11 5l-6 6" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current"><path d="M5 3.2v9.6L12.5 8z" /></svg>
          )}
        </span>
      </button>

      <style>{`@keyframes mr-video-ring-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

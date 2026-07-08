'use client';

import React from 'react';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

interface AnnouncementBarProps {
  messages?: string[];
  enabled?: boolean;
  linkUrl?: string | null;
  background?: string | null;
}

const FALLBACK_MESSAGES = [
  '✦ FREE WORLDWIDE SHIPPING ON ORDERS OVER €200',
  '✦ LIMITED EDITION — OUD NOCTURNE RELEASED TODAY',
  '✦ 10% OFF YOUR FIRST ORDER · CODE MINIRUE10',
];

const DEFAULT_BACKGROUND =
  'linear-gradient(90deg, var(--mr-gold-500) 0%, var(--mr-gold-400) 30%, var(--mr-crimson-700) 70%, var(--mr-gold-500) 100%)';

export default function AnnouncementBar({
  messages = FALLBACK_MESSAGES,
  enabled = true,
  linkUrl = null,
  background = null,
}: AnnouncementBarProps) {
  // Plain in-memory state, deliberately not persisted anywhere — every full
  // page load (refresh, new tab) starts clean/visible, and the first-scroll
  // gesture within that page view collapses it as before. A prior version
  // persisted this to sessionStorage on the theory that sessionStorage
  // clears on refresh; it does not (only on tab close), so once a visitor
  // scrolled once, the bar stayed collapsed on every subsequent refresh
  // instead of resetting.
  const [hidden, setHidden] = React.useState(false);

  // Phase 5 — Responsive sizing: scale down on mobile and small screens
  const bp = useBreakpoint();
  const isTiny = bp.w > 0 && bp.w <= 480;
  const isMobile = bp.mobile; // w < 640

  const barHeight = isTiny ? 24 : isMobile ? 28 : 34;
  const textPadding = isTiny ? '0 12px' : isMobile ? '0 20px' : '0 32px';
  const textFontSize = isMobile ? 10 : 11;
  const marqueeDuration = isMobile ? '45s' : '90s';

  if (!enabled || messages.length === 0) return null;

  // PATCH announcement-bar-collapse-on-first-scroll
  // The first scroll gesture (wheel OR downward touch swipe) collapses the bar
  // and is consumed — the page does not scroll on that gesture. Subsequent
  // gestures scroll normally. Lenis listens on document.documentElement for
  // `wheel`/`touchmove` in bubble phase; we register in capture phase on
  // `window` with { passive: false } so preventDefault/stopPropagation runs
  // before Lenis sees the event, and stopPropagation ensures Lenis never
  // receives it. The handler self-removes after the first match.
  // The `setHidden(true)` call below now also persists to sessionStorage
  // via the setter wrapper above, so the collapsed state survives
  // forward/back navigation within the same tab.
  React.useEffect(() => {
    let touchStartY: number | null = null;
    const SWIPE_DOWN_DEADBAND = 4; // px before a touchmove counts as a downward swipe

    const collapse = (event: Event) => {
      if (!event.cancelable) return;
      event.preventDefault();
      event.stopPropagation();
      setHidden(true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('touchmove', onTouchMove, true);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY <= 0) return; // only collapse on downward scroll intent
      collapse(event);
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStartY = touch ? touch.clientY : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (touchStartY === null) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dy = touch.clientY - touchStartY;
      if (dy <= SWIPE_DOWN_DEADBAND) return; // only collapse on swipe-down
      collapse(event);
    };

    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('touchmove', onTouchMove, true);
    };
    // The effect intentionally runs only once on mount.
    // setHidden is now stable across renders via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doubled = [...messages, ...messages, ...messages];

  const textStyle: React.CSSProperties = {
    padding: textPadding,
    fontFamily: 'Jost, sans-serif',
    fontSize: textFontSize,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    fontWeight: 500,
    textShadow: '0 1px 2px rgba(11,11,11,0.35)',
    color: 'inherit',
  };

  return (
    <div
      aria-label="Announcements"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        height: hidden ? 0 : barHeight,
        overflow: 'hidden',
        transition: 'height 320ms cubic-bezier(0.4,0,0.2,1)',
        background: background?.trim() || DEFAULT_BACKGROUND,
        backgroundSize: background?.trim() ? undefined : '200% 100%',
        animation: background?.trim() ? undefined : 'mr-announce-shimmer 8s linear infinite',
        color: 'var(--mr-cream-100)',
        borderBottom: '1px solid rgba(238,230,209,.12)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          height: '100%',
          alignItems: 'center',
          animation: `mr-marquee ${marqueeDuration} linear infinite`,
          whiteSpace: 'nowrap',
        }}
      >
        {doubled.map((m, i) =>
          linkUrl ? (
            <a
              key={i}
              href={linkUrl}
              style={{
                ...textStyle,
                textDecoration: 'none',
              }}
            >
              {m}
            </a>
          ) : (
            <span key={i} style={textStyle}>
              {m}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

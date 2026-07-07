'use client';

import React from 'react';

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
  const [hidden, setHidden] = React.useState(false);

  if (!enabled || messages.length === 0) return null;

  // PATCH announcement-bar-collapse-on-first-scroll
  // The first scroll gesture (wheel OR downward touch swipe) collapses the bar
  // and is consumed — the page does not scroll on that gesture. Subsequent
  // gestures scroll normally. Lenis listens on document.documentElement for
  // `wheel`/`touchmove` in bubble phase; we register in capture phase on
  // `window` with { passive: false } so preventDefault/stopPropagation runs
  // before Lenis sees the event, and stopPropagation ensures Lenis never
  // receives it. The handler self-removes after the first match.
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
  }, []);

  const doubled = [...messages, ...messages, ...messages];

  return (
    <div
      aria-label="Announcements"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        height: hidden ? 0 : 34,
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
          animation: 'mr-marquee 90s linear infinite',
          whiteSpace: 'nowrap',
        }}
      >
        {doubled.map((m, i) =>
          linkUrl ? (
            <a
              key={i}
              href={linkUrl}
              style={{
                padding: '0 32px',
                fontFamily: 'Jost, sans-serif',
                fontSize: 11,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(11,11,11,0.35)',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              {m}
            </a>
          ) : (
            <span
              key={i}
              style={{
                padding: '0 32px',
                fontFamily: 'Jost, sans-serif',
                fontSize: 11,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(11,11,11,0.35)',
              }}
            >
              {m}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

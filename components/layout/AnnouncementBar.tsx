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

// PATCH announcement-bar-collapse-on-first-scroll (back-nav preservation)
// sessionStorage key used to persist the bar's `hidden` state across
// client-side navigations and the browser back button. The value is
// written by the `setHidden` wrapper below and read in the re-hydration
// useEffect on mount. Cleared (key removed) on full page refresh by the
// browser itself, so the bar reappears on F5 / Cmd-R / pull-to-refresh.
const HIDDEN_STORAGE_KEY = 'announcement-bar:hidden';

export default function AnnouncementBar({
  messages = FALLBACK_MESSAGES,
  enabled = true,
  linkUrl = null,
  background = null,
}: AnnouncementBarProps) {
  const [hidden, setHiddenRaw] = React.useState(false);

  // PATCH announcement-bar-collapse-on-first-scroll (back-nav preservation)
  // Re-hydrate the `hidden` state from sessionStorage on mount so that the
  // collapse survives client-side navigation and the browser back button.
  // sessionStorage is per-tab — the design intent (see the K3 walkthrough
  // in plans/announcement-bar-collapse-on-first-scroll/README.md) is that
  // it is cleared on a full page refresh, so the bar reappears on F5 while
  // staying collapsed across forward/back navigation within the same tab.
  // The first render deliberately uses `hidden=false` so that the SSR
  // HTML and the first client render match (no hydration mismatch); the
  // sessionStorage read happens in an effect and may cause a one-frame
  // flash of the visible bar on back-nav. That flash is acceptable
  // because reading sessionStorage in a lazy initializer would produce
  // a hydration mismatch.
  React.useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(HIDDEN_STORAGE_KEY) === 'true'
    ) {
      setHiddenRaw(true);
    }
  }, []);

  // Stable setter wrapper that mirrors every state change to sessionStorage
  // so that the existing first-scroll handler (which only knows the
  // `setHidden` name) also persists the collapse. Signature matches the
  // React state-setter shape so existing call sites (`setHidden(true)`)
  // keep working unchanged.
  const setHidden = (value: boolean): void => {
    setHiddenRaw(value);
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      try {
        if (value) {
          sessionStorage.setItem(HIDDEN_STORAGE_KEY, 'true');
        } else {
          sessionStorage.removeItem(HIDDEN_STORAGE_KEY);
        }
      } catch {
        // sessionStorage can throw in private-mode Safari or when the
        // quota is exhausted. The in-memory state still works for the
        // current page; persistence is best-effort.
      }
    }
  };

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
    // setHidden is stable across renders (it closes over setHiddenRaw).
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

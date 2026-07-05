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

  React.useEffect(() => {
    const onScroll = () => {
      setHidden(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

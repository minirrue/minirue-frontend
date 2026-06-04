'use client';

import React from 'react';
import Sparkle from './Sparkle';

interface MarqueeProps {
  items: string[];
  speed?: number;
  surface?: 'ink' | 'cream';
}

export default function Marquee({ items, speed = 38, surface = 'ink' }: MarqueeProps) {
  const doubled = [...items, ...items];
  const isDark = surface === 'ink';

  return (
    <div
      style={{
        overflow: 'hidden',
        background: isDark ? 'var(--mr-ink-900)' : 'var(--mr-cream-300)',
        color: isDark ? 'var(--mr-cream-200)' : 'var(--mr-ink-700)',
        padding: '13px 0',
        borderTop: isDark ? '1px solid rgba(238,230,209,.08)' : '1px solid var(--mr-hairline)',
        borderBottom: isDark ? '1px solid rgba(238,230,209,.08)' : '1px solid var(--mr-hairline)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: `mr-marquee ${speed}s linear infinite`,
        }}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              padding: '0 28px',
              opacity: isDark ? 0.65 : 0.75,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 24,
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkle size={7} color={isDark ? 'var(--mr-gold-400)' : 'var(--mr-gold-500)'} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

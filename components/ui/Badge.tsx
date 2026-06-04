'use client';

import React from 'react';

type BadgeKind = 'new' | 'sale' | 'gold' | 'soft' | 'outline';

interface BadgeProps {
  kind?: BadgeKind;
  children: React.ReactNode;
}

const STYLES: Record<BadgeKind, React.CSSProperties> = {
  new:     { background: 'var(--mr-ink-900)',    color: 'var(--mr-cream-100)' },
  sale:    { background: 'var(--mr-crimson-700)', color: 'var(--mr-cream-100)' },
  gold:    { background: 'var(--mr-gold-500)',    color: 'var(--mr-cream-100)' },
  soft:    { background: 'var(--mr-cream-300)',   color: 'var(--mr-ink-700)' },
  outline: { border: '1px solid var(--mr-border)', color: 'var(--mr-ink-700)' },
};

export default function Badge({ kind = 'soft', children }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '5px 12px',
        borderRadius: 'var(--mr-radius-pill)',
        fontFamily: 'Jost, sans-serif',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        lineHeight: 1,
        ...STYLES[kind],
      }}
    >
      {children}
    </span>
  );
}

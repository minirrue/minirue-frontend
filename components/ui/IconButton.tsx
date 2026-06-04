'use client';

import React from 'react';
import Icon from './Icon';
import { MR_TX } from '@/lib/motion/presets';

type Tone = 'cream' | 'ink' | 'gold' | 'glass';

interface IconButtonProps {
  icon: string;
  onClick?: () => void;
  size?: number;
  tone?: Tone;
  label: string;
  badge?: number;
  badgeBump?: boolean;
}

const TONES: Record<Tone, { bg: string; fg: string; bgH: string }> = {
  cream: { bg: 'var(--mr-cream-100)', fg: 'var(--mr-ink-900)',   bgH: 'var(--mr-cream-300)' },
  ink:   { bg: 'var(--mr-ink-900)',   fg: 'var(--mr-cream-100)', bgH: 'var(--mr-ink-700)' },
  gold:  { bg: 'var(--mr-gold-500)',  fg: 'var(--mr-cream-100)', bgH: 'var(--mr-gold-700)' },
  glass: { bg: 'rgba(253,251,245,.12)', fg: 'var(--mr-cream-100)', bgH: 'rgba(253,251,245,.22)' },
};

export default function IconButton({
  icon,
  onClick,
  size = 40,
  tone = 'cream',
  label,
  badge,
  badgeBump,
}: IconButtonProps) {
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);
  const t = TONES[tone];

  return (
    <button
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); setP(false); }}
      onMouseDown={() => setP(true)}
      onMouseUp={() => setP(false)}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 'var(--mr-radius-pill)',
        background: h ? t.bgH : t.bg,
        color: t.fg,
        border: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: p ? 'scale(0.94)' : h ? 'scale(var(--mp-scale-hover,1.02))' : 'scale(1)',
        transition: p ? MR_TX.press : MR_TX.hover,
        boxShadow: tone === 'glass' ? 'none' : 'var(--mr-shadow-sm)',
        flexShrink: 0,
      }}
    >
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={Math.round(size * 0.44)} />
      {(badge ?? 0) > 0 && (
        <span
          data-bump={badgeBump ? '1' : '0'}
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 999,
            background: 'var(--mr-crimson-700)',
            color: 'var(--mr-cream-100)',
            fontFamily: 'Jost, sans-serif',
            fontSize: 10,
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--mr-shadow-sm)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

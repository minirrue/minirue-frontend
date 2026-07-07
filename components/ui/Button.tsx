'use client';

import React from 'react';
import { MR_TX } from '@/lib/motion/presets';

type Variant = 'primary' | 'gold' | 'outline' | 'outlineLight' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  sweep?: boolean;
  sweepColor?: string;
  sweepInk?: string;
  type?: 'button' | 'submit' | 'reset';
  /** RULEBOOK §27 — full data-trace-id for this button, e.g.
   * "PG-STOREFRONT-IAM-001::EL-BTN-submit-login". Caller-supplied because this component is
   * reused across every screen, each with its own PG-* id. */
  traceId?: string;
}

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary:      { background: 'var(--mr-ink-900)',    color: 'var(--mr-cream-100)', boxShadow: 'var(--mr-shadow-md)' },
  gold:         { background: 'var(--mr-gold-500)',   color: 'var(--mr-cream-100)', boxShadow: 'var(--mr-shadow-md)' },
  outline:      { background: 'transparent',          color: 'var(--mr-ink-900)',   borderColor: 'var(--mr-ink-900)' },
  outlineLight: { background: 'transparent',          color: 'var(--mr-cream-100)', borderColor: 'rgba(253,251,245,0.75)' },
  ghost:        { background: 'transparent',          color: 'var(--mr-ink-900)',   border: '0', borderBottom: '1px solid var(--mr-gold-400)', padding: '8px 0', borderRadius: '0' },
};

const HOVER_STYLES: Record<Variant, React.CSSProperties> = {
  primary:      { background: 'var(--mr-ink-700)' },
  gold:         { background: 'var(--mr-gold-700)' },
  outline:      { background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)' },
  outlineLight: { background: 'rgba(253,251,245,0.15)' },
  ghost:        { color: 'var(--mr-gold-700)' },
};

const SWEEP_HOVER: Record<Variant, React.CSSProperties> = {
  primary:      { color: 'var(--mr-ink-900)' },
  gold:         { color: 'var(--mr-ink-900)' },
  outline:      { color: 'var(--mr-cream-100)' },
  outlineLight: { color: 'var(--mr-ink-900)' },
  ghost:        { color: 'var(--mr-gold-700)' },
};

function Button({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled,
  style,
  sweep = false,
  sweepColor,
  sweepInk,
  type = 'button',
  traceId,
}: ButtonProps) {
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);

  const handleMouseEnter = React.useCallback(() => setH(true), []);
  const handleMouseLeave = React.useCallback(() => { setH(false); setP(false); }, []);
  const handleMouseDown = React.useCallback(() => setP(true), []);
  const handleMouseUp = React.useCallback(() => setP(false), []);

  const base: React.CSSProperties = {
    fontFamily: 'Jost, sans-serif',
    fontSize: size === 'sm' ? 11 : 12,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    padding: size === 'sm' ? '17px 18px' : '14px 26px',
    borderRadius: variant === 'ghost' ? 0 : 'var(--mr-radius-pill)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    opacity: disabled ? 0.4 : 1,
    willChange: h || p ? 'transform' : 'auto',
    lineHeight: 1,
    ...style,
  };

  const scale = p ? 'scale(0.96)' : h && !disabled ? 'scale(var(--mp-scale-hover, 1.02))' : 'scale(1)';

  const hoverStyle = sweep
    ? { ...SWEEP_HOVER[variant], ...(sweepInk ? { color: sweepInk } : {}) }
    : HOVER_STYLES[variant];

  const sweepVars = sweep
    ? ({ '--sweep-color': sweepColor ?? 'var(--mr-cream-100)' } as React.CSSProperties)
    : {};

  return (
    <button
      type={type}
      data-trace-id={traceId}
      className={sweep ? 'mr-btn-sweep' : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        ...base,
        ...VARIANTS[variant],
        ...(h && !disabled ? hoverStyle : {}),
        ...sweepVars,
        transform: scale,
        transition: p
          ? MR_TX.press
          : 'transform var(--mp-dur-hover) var(--mr-ease-spring), background-color var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy), box-shadow var(--mr-dur-fast) var(--mr-ease-out)',
      }}
    >
      {sweep ? <span style={{ position: 'relative', zIndex: 1 }}>{children}</span> : children}
    </button>
  );
}

export default React.memo(Button);

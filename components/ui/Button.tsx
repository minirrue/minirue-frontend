'use client';

import React from 'react';
import Link from 'next/link';
import { MR_TX } from '@/lib/motion/presets';

type Variant = 'primary' | 'gold' | 'outline' | 'outlineLight' | 'ghost' | 'danger' | 'dangerOutline';
type Size = 'sm' | 'md';

interface ButtonProps {
  variant?: Variant;
  /**
   * `sm` is the default and the house shape (frontend#105): the owner asked for
   * every button to be the same shape as chat's "Start conversation" and
   * account "Sign out" — Jost 11px, 0.22em, 17px 18px, pill. `md` remains for a
   * surface that genuinely needs the larger type, and nothing uses it today.
   */
  size?: Size;
  children: React.ReactNode;
  /** On a link (`href`) this runs before navigation — e.g. closing the sheet
   * or drawer the link sits in. */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  /**
   * The gliding fill on hover. ON by default since 2026-08-21 — the owner
   * asked for the "Proceed to checkout" pill's behaviour to be what a button
   * on this site DOES, rather than something each call site had to remember to
   * opt into. Pass `sweep={false}` only where the animation is genuinely wrong
   * for the surface.
   */
  sweep?: boolean;
  sweepColor?: string;
  sweepInk?: string;
  type?: 'button' | 'submit' | 'reset';
  /**
   * Render as a LINK that looks like this button, rather than a `<button>`.
   *
   * A navigation is a link — it has to middle-click, open in a new tab and
   * show its destination on hover, none of which an `onClick` that calls
   * `router.push` can do. And a `<button>` nested inside an `<a>` is invalid
   * HTML, so wrapping is not the answer either.
   *
   * This exists because the chat's sign-in prompt was styled with
   * `className="mr-btn mr-btn--primary"` — class names that are not defined in
   * any stylesheet in this repo, so the control rendered as bare text with no
   * affordance at all (#9). The fix for that is to make the shared component
   * cover the case, not to hand-style one more call site.
   */
  href?: string;
  /** Link only — forwarded to next/link. */
  prefetch?: boolean;
  /** Link only — `_blank` opens a new tab, with `rel="noopener noreferrer"`. */
  target?: '_blank';
  ariaLabel?: string;
  /** RULEBOOK §27 — full data-trace-id for this button, e.g.
   * "PG-STOREFRONT-IAM-001::EL-BTN-submit-login". Caller-supplied because this component is
   * reused across every screen, each with its own PG-* id. */
  traceId?: string;
  /** The rendered `<button>`/`<a>`, for callers that observe or focus it (the
   * sticky buy bar watches the product page's Add to bag). React 19 passes
   * `ref` to a function component as a plain prop. */
  ref?: React.Ref<HTMLElement>;
  title?: string;
  /** Announces disabled while staying clickable — for a control that says why
   * it cannot run when pressed. Not swept, like `disabled`. */
  ariaDisabled?: boolean;
  testId?: string;
}

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary:      { background: 'var(--mr-ink-900)',    color: 'var(--mr-cream-100)', boxShadow: 'var(--mr-shadow-md)' },
  gold:         { background: 'var(--mr-gold-500)',   color: 'var(--mr-cream-100)', boxShadow: 'var(--mr-shadow-md)' },
  outline:      { background: 'transparent',          color: 'var(--mr-ink-900)',   borderColor: 'var(--mr-ink-900)' },
  outlineLight: { background: 'transparent',          color: 'var(--mr-cream-100)', borderColor: 'rgba(253,251,245,0.75)' },
  ghost:        { background: 'transparent',          color: 'var(--mr-ink-900)',   border: '0', borderBottom: '1px solid var(--mr-gold-400)', padding: '8px 0', borderRadius: '0' },
  // Destructive actions (cancel an order, delete an address) — same shape.
  danger:        { background: 'var(--mr-danger)',    color: 'var(--mr-cream-100)', boxShadow: 'var(--mr-shadow-md)' },
  dangerOutline: { background: 'transparent',         color: 'var(--mr-danger)',    borderColor: 'var(--mr-danger)' },
};

const HOVER_STYLES: Record<Variant, React.CSSProperties> = {
  primary:      { background: 'var(--mr-ink-700)' },
  gold:         { background: 'var(--mr-gold-700)' },
  outline:      { background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)' },
  outlineLight: { background: 'rgba(253,251,245,0.15)' },
  ghost:        { color: 'var(--mr-gold-700)' },
  danger:        { background: '#6F0F12' },
  dangerOutline: { background: 'var(--mr-danger)', color: 'var(--mr-cream-100)' },
};

/**
 * What the sweep panel is PAINTED with, per variant.
 *
 * This used to be one value for every variant — `--mr-cream-100` — and that was
 * a real, visible bug on `outline`. An outline button sweeps cream, and its
 * swept label colour is also cream (below), so the words vanished the moment
 * the fill passed under them. Nobody noticed because the default sweep pill in
 * use was `primary`, which is dark and reads correctly against cream.
 *
 * The rule now: each variant sweeps to the INVERSE of its resting surface, and
 * `SWEEP_HOVER` names the label colour that is legible against that. Read the
 * two tables as pairs — changing one without the other is exactly how the text
 * disappeared. Owner, 2026-08-21: "make sure when color changes the text is
 * visible also."
 */
const SWEEP_FILL: Record<Variant, string> = {
  // Dark button, cream fill.
  primary:      'var(--mr-cream-100)',
  gold:         'var(--mr-cream-100)',
  // Transparent-on-cream button, INK fill — matching its non-sweep hover,
  // which has always been `background: ink-900 / color: cream-100`.
  outline:      'var(--mr-ink-900)',
  // Transparent-on-dark button, cream fill.
  outlineLight: 'var(--mr-cream-100)',
  // No panel: ghost is an underline, not a surface.
  ghost:        'transparent',
  // Red button, cream fill; red outline, red fill.
  danger:        'var(--mr-cream-100)',
  dangerOutline: 'var(--mr-danger)',
};

const SWEEP_HOVER: Record<Variant, React.CSSProperties> = {
  primary:      { color: 'var(--mr-ink-900)' },
  gold:         { color: 'var(--mr-ink-900)' },
  outline:      { color: 'var(--mr-cream-100)' },
  outlineLight: { color: 'var(--mr-ink-900)' },
  ghost:        { color: 'var(--mr-gold-700)' },
  danger:        { color: 'var(--mr-danger)' },
  dangerOutline: { color: 'var(--mr-cream-100)' },
};

function Button({
  variant = 'primary',
  size = 'sm',
  children,
  onClick,
  disabled,
  style,
  sweep = true,
  sweepColor,
  sweepInk,
  type = 'button',
  traceId,
  href,
  prefetch,
  target,
  ariaLabel,
  ref,
  title,
  ariaDisabled,
  testId,
}: ButtonProps) {
  const inert = disabled || ariaDisabled;
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
    cursor: disabled || ariaDisabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    opacity: disabled || ariaDisabled ? 0.4 : 1,
    willChange: h || p ? 'transform' : 'auto',
    lineHeight: 1,
    ...style,
  };

  const scale = p ? 'scale(0.96)' : h && !inert ? 'scale(var(--mp-scale-hover, 1.02))' : 'scale(1)';

  /**
   * `ghost` never sweeps, whatever the caller asks.
   *
   * It is an underlined word, not a surface — there is nothing for a panel to
   * fill. Now that `sweep` defaults to true, opting ghost out here is what stops
   * every ghost button on the site silently acquiring `overflow: hidden` and an
   * invisible transparent panel from `.mr-btn-sweep`.
   */
  const swept = sweep && variant !== 'ghost';

  const hoverStyle = swept
    ? { ...SWEEP_HOVER[variant], ...(sweepInk ? { color: sweepInk } : {}) }
    : HOVER_STYLES[variant];

  // Per-variant fill, so an outline button no longer sweeps cream under a
  // cream label. An explicit `sweepColor` still wins.
  const sweepVars = swept
    ? ({
        '--sweep-color': sweepColor ?? SWEEP_FILL[variant],
        // The label colour against the swept panel, applied by the stylesheet on
        // the same `:hover:not(:disabled)` that runs the panel (frontend#79), so
        // the two can never disagree.
        '--sweep-ink': sweepInk ?? String(SWEEP_HOVER[variant].color ?? 'inherit'),
      } as React.CSSProperties)
    : {};

  const visualStyle: React.CSSProperties = {
    ...base,
    ...VARIANTS[variant],
    ...(h && !inert ? hoverStyle : {}),
    ...sweepVars,
    transform: scale,
    transition: p
      ? MR_TX.press
      : 'transform var(--mp-dur-hover) var(--mr-ease-spring), background-color var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy), box-shadow var(--mr-dur-fast) var(--mr-ease-out)',
  };

  const pointerProps = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
  };

  // The sweep panel is a positioned ::before, and CSS paints positioned
  // descendants ABOVE an element's own inline content — so the label has to be
  // wrapped or the fill glides over the words. Same reason EditorialBlock and
  // SlideContent wrap theirs.
  //
  // The wrapper is itself an inline flex row with the button's gap: Tailwind's
  // preflight makes every `svg` display:block, so inside a plain span an icon
  // took a line of its own — "Added" sat under its tick (owner, 2026-09-13).
  const label = swept ? (
    <span
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'inherit',
        minWidth: 0,
      }}
    >
      {children}
    </span>
  ) : (
    children
  );

  if (href) {
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        prefetch={prefetch}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        aria-label={ariaLabel}
        aria-disabled={ariaDisabled || undefined}
        title={title}
        data-testid={testId}
        onClick={onClick}
        data-trace-id={traceId}
        className={swept ? 'mr-btn-sweep' : undefined}
        {...pointerProps}
        style={{ ...visualStyle, textDecoration: 'none' }}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      aria-label={ariaLabel}
      aria-disabled={ariaDisabled || undefined}
      title={title}
      data-testid={testId}
      data-trace-id={traceId}
      className={swept ? 'mr-btn-sweep' : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...pointerProps}
      style={visualStyle}
    >
      {label}
    </button>
  );
}

export default React.memo(Button);

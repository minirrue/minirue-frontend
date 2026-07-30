'use client';
/**
 * motion-primitives TextEffect — https://motion-primitives.com/docs/text-effect
 *
 * Copied in narrowly, not vendored whole: only the `per='char'` / `preset='fade'`
 * path this codebase actually uses (the Ebneely footer signature). See
 * `components/core/carousel.tsx` for the same "copy the primitive, brand the
 * caller" convention this follows.
 *
 * One deliberate departure from upstream: `prefers-reduced-motion` is checked
 * here, not left to the caller. `mr-tokens.css` caps every CSS
 * `transition-duration` under that media query, but `motion/react` drives this
 * per-character stagger through its own animation engine, not a CSS
 * transition — the stylesheet rule cannot reach it. Reduced motion renders the
 * plain string with no per-character split and no animation at all.
 */

import React from 'react';
import { motion, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export type TextEffectPer = 'word' | 'char' | 'line';
export type TextEffectPreset = 'fade' | 'blur' | 'fade-in-blur' | 'scale' | 'slide';

export interface TextEffectProps {
  children: string;
  per?: TextEffectPer;
  as?: keyof React.JSX.IntrinsicElements;
  preset?: TextEffectPreset;
  className?: string;
  style?: React.CSSProperties;
  /** Seconds before the first segment starts. */
  delay?: number;
  /** Seconds between each segment's start. */
  speedReveal?: number;
  onAnimationComplete?: () => void;
}

const defaultContainer: Variants = {
  hidden: { opacity: 0 },
  visible: (speedReveal: number) => ({
    opacity: 1,
    transition: { staggerChildren: speedReveal },
  }),
};

const PRESET_ITEM: Record<TextEffectPreset, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  blur: {
    hidden: { opacity: 0, filter: 'blur(6px)' },
    visible: { opacity: 1, filter: 'blur(0px)' },
  },
  'fade-in-blur': {
    hidden: { opacity: 0, filter: 'blur(10px)', y: 4 },
    visible: { opacity: 1, filter: 'blur(0px)', y: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.6 },
    visible: { opacity: 1, scale: 1 },
  },
  slide: {
    hidden: { opacity: 0, y: '0.3em' },
    visible: { opacity: 1, y: 0 },
  },
};

function splitSegments(text: string, per: TextEffectPer): string[] {
  if (per === 'line') return text.split('\n');
  if (per === 'word') return text.split(' ');
  // per === 'char': split into words first so a line break never lands
  // mid-word, then flatten each word's characters plus a trailing space.
  return text
    .split(' ')
    .flatMap((word, i, words) => [...word.split(''), ...(i < words.length - 1 ? [' '] : [])]);
}

/**
 * Renders the segments as plain, unanimated text — used both as the
 * reduced-motion output and, implicitly, as what a snapshot of "visible"
 * looks like once every stagger step has resolved.
 */
function StaticText({
  as: As = 'p',
  className,
  style,
  children,
}: {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: string;
}) {
  const Component = As as React.ElementType;
  return (
    <Component className={className} style={style}>
      {children}
    </Component>
  );
}

export function TextEffect({
  children,
  per = 'word',
  as = 'p',
  preset = 'fade',
  className,
  style,
  delay = 0,
  speedReveal = 0.035,
  onAnimationComplete,
}: TextEffectProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return (
      <StaticText as={as} className={className} style={style}>
        {children}
      </StaticText>
    );
  }

  const segments = splitSegments(children, per);
  const itemVariants = PRESET_ITEM[preset];

  // The animated wrapper is always a <span> — `as` only decides the
  // reduced-motion / SSR-fallback tag above. A footer signature line and
  // similar inline maker's-marks never need the animated wrapper itself to
  // be a block element, and keeping this to one concrete `motion.span`
  // avoids indexing the `motion` proxy with an arbitrary string, which
  // `motion/react`'s types don't support cleanly.
  return (
    <motion.span
      className={cn('inline-block', className)}
      style={style}
      initial="hidden"
      animate="visible"
      custom={speedReveal}
      variants={defaultContainer}
      transition={{ delay }}
      onAnimationComplete={onAnimationComplete}
    >
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {segments.map((segment, i) => (
          <motion.span
            key={`${per}-${i}-${segment}`}
            variants={itemVariants}
            className="inline-block whitespace-pre"
          >
            {segment}
          </motion.span>
        ))}
      </span>
    </motion.span>
  );
}

export default TextEffect;

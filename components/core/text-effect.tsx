'use client';
/**
 * A per-segment reveal for a short line of text.
 *
 * Was a narrow copy of motion-primitives' TextEffect driving a `motion/react`
 * stagger. It is now CSS keyframes with a per-segment `animation-delay`, which
 * produces the same reveal and lets the last `motion/react` import in the
 * codebase go with it.
 *
 * ## Why that mattered enough to rewrite
 *
 * This component renders the Ebneely footer signature, and the footer is on
 * EVERY page. So `motion` (~56KB) was not a product-page cost that happened to
 * be shared — it was a sitewide cost, paid on the cart and the shop index too,
 * for one line of animated small print.
 *
 * `next/dynamic` does not solve this and it was measured: with `ssr: true` the
 * chunk splits out of the entry (verified — it stops being preloaded in the
 * HTML) but React still fetches it immediately to hydrate the server-rendered
 * markup, so the bytes arrive during exactly the window that matters. Deleting
 * the dependency is the only thing that removes it. See minirue-frontend#7,
 * where the product page's LCP image is measured taking 1806ms to transfer
 * 78KB because it shares a 1.6 Mbps pipe with ~283KB of concurrent JavaScript.
 *
 * ## Why CSS reaches this and could not before
 *
 * The old file's header noted a real constraint: `mr-tokens.css` caps every CSS
 * `transition-duration` under `prefers-reduced-motion`, but that rule could not
 * reach a `motion/react` animation because it is not a CSS transition. That
 * asymmetry is gone — this is a CSS animation now, and it is ALSO still handled
 * explicitly below, because the tokens file caps transitions rather than
 * animations and an unanimated fallback is clearer than a 0.01s one.
 *
 * The reduced-motion branch renders the plain string with no per-character
 * split and no animation, exactly as before.
 */

import React from 'react';
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

/**
 * The five presets, as the FROM half of each keyframe pair. Every one animates
 * to the element's natural state, so the TO half is identical for all of them
 * and lives in the stylesheet below rather than being repeated per preset.
 */
const PRESET_FROM: Record<TextEffectPreset, string> = {
  fade: 'opacity:0',
  blur: 'opacity:0;filter:blur(6px)',
  'fade-in-blur': 'opacity:0;filter:blur(10px);transform:translateY(4px)',
  scale: 'opacity:0;transform:scale(0.6)',
  slide: 'opacity:0;transform:translateY(0.3em)',
};

/**
 * One stylesheet for every preset, emitted once.
 *
 * Inline rather than in `globals.css` because the keyframes and the component
 * are a single unit — a preset added here without its keyframe is a silent
 * no-animation, and the two drifting apart across files is how that happens.
 * Next de-duplicates identical <style> content, and the footer is the only
 * consumer, so this is one small block in the document regardless of how many
 * segments it renders.
 */
const STYLES = `
${(Object.keys(PRESET_FROM) as TextEffectPreset[])
  .map(
    (preset) => `@keyframes mr-te-${preset}{from{${PRESET_FROM[preset]}}to{opacity:1;filter:none;transform:none}}`,
  )
  .join('\n')}
.mr-te-seg{
  display:inline-block;
  white-space:pre;
  /* The element's resting state IS the animation's end state, so a segment
     whose animation has not started yet must be held invisible explicitly.
     animation-fill-mode: backwards applies the from-frame during the delay;
     without it every character paints first and then re-fades, which reads
     as a flicker. */
  animation-duration:var(--mr-te-dur,.5s);
  animation-timing-function:var(--mr-ease-out,cubic-bezier(.22,1,.36,1));
  animation-fill-mode:backwards;
}
.mr-te-word{
  display:inline-block;
  white-space:nowrap;
}
`;

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

  /*
   * `onAnimationComplete` fired off motion's own lifecycle. Reproduced with a
   * timer rather than an `animationend` listener because the caller means "the
   * whole reveal is done", and `animationend` fires once PER SEGMENT — for the
   * footer signature that is 44 events, and the last one to fire is not
   * necessarily the last one to finish.
   */
  const total = React.useMemo(
    () => delay + splitSegments(children, per).length * speedReveal + 0.5,
    [children, per, delay, speedReveal],
  );
  React.useEffect(() => {
    if (!onAnimationComplete || reducedMotion) return;
    const t = window.setTimeout(onAnimationComplete, total * 1000);
    return () => window.clearTimeout(t);
  }, [onAnimationComplete, reducedMotion, total]);

  if (reducedMotion) {
    return (
      <StaticText as={as} className={className} style={style}>
        {children}
      </StaticText>
    );
  }

  const segments = splitSegments(children, per);
  let charIndex = 0;

  // `as` only decides the reduced-motion fallback tag above; the animated
  // wrapper is always a <span>. A footer signature and similar inline
  // maker's-marks never need it to be a block element.
  return (
    <span className={cn('inline-block', className)} style={style}>
      <style>{STYLES}</style>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {per === 'char'
          ? children.split(' ').map((word, wordIndex, words) => {
              const chars = [...word, ...(wordIndex < words.length - 1 ? [' '] : [])];
              return (
                <span
                  key={`word-${wordIndex}-${word}`}
                  className="mr-te-word"
                  data-mr-text-word=""
                >
                  {chars.map((segment) => {
                    const i = charIndex++;
                    return (
                      <span
                        key={`char-${i}-${segment}`}
                        className="mr-te-seg"
                        style={{
                          animationName: `mr-te-${preset}`,
                          animationDelay: `${delay + i * speedReveal}s`,
                        }}
                      >
                        {segment}
                      </span>
                    );
                  })}
                </span>
              );
            })
          : segments.map((segment, i) => (
              <span
                key={`${per}-${i}-${segment}`}
                className="mr-te-seg"
                style={{
                  animationName: `mr-te-${preset}`,
                  animationDelay: `${delay + i * speedReveal}s`,
                }}
              >
                {segment}
              </span>
            ))}
      </span>
    </span>
  );
}

export default TextEffect;

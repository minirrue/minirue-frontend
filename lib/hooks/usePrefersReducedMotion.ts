'use client';

/**
 * usePrefersReducedMotion — reads `(prefers-reduced-motion: reduce)`.
 *
 * `mr-tokens.css` already caps every CSS `transition-duration` to 0.01ms under
 * this media query, so plain CSS-transition motion (slides, fades) is covered
 * for free. This hook exists for the motion that CSS alone cannot reach:
 * per-character text animation driven by `motion/react` (components/core/
 * text-effect.tsx) and the JS-driven drag/snap on the chat bubble, both of
 * which need to branch in JS rather than lean on a stylesheet rule.
 */

import React from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

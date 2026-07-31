'use client';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

/**
 * Three-dot loading indicator (owner-supplied component, 2026-07-31 — use
 * this exact shape for the storefront's page loader, not a different
 * spinner). Pure inline SVG, no dependency: it inherits colour from
 * `currentColor`, which the `text-foreground` class set on this SVG asks
 * for. This app has no `--foreground` token (it is not a shadcn project —
 * see `app/styles/mr-tokens.css`), so the wrapper that renders this sets
 * `color: var(--mr-fg)` rather than relying on a `text-foreground` Tailwind
 * utility that doesn't resolve to anything here.
 *
 * The three `<animate>` (SMIL) elements are the bouncing-dot motion. SMIL is
 * NOT covered by mr-tokens.css's `prefers-reduced-motion` rule (that rule
 * only caps CSS `animation`/`transition` durations) — so this component
 * reads the same `usePrefersReducedMotion` hook every other JS-driven motion
 * in this app uses, and simply omits the `<animate>` children when the user
 * has asked for less motion. The three dots still render, just still.
 */
function MessageLoading() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="text-foreground"
      style={{ color: 'var(--mr-fg)' }}
      aria-hidden="true"
    >
      <circle cx="4" cy="12" r="2" fill="currentColor">
        {reducedMotion ? null : (
          <animate
            id="spinner_qFRN"
            begin="0;spinner_OcgL.end+0.25s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        )}
      </circle>
      <circle cx="12" cy="12" r="2" fill="currentColor">
        {reducedMotion ? null : (
          <animate
            begin="spinner_qFRN.begin+0.1s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        )}
      </circle>
      <circle cx="20" cy="12" r="2" fill="currentColor">
        {reducedMotion ? null : (
          <animate
            id="spinner_OcgL"
            begin="spinner_qFRN.begin+0.2s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        )}
      </circle>
    </svg>
  );
}

export { MessageLoading };

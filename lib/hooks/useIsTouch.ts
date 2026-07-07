'use client';

// Singleton touch detection — module-level cached result shared across all consumers.
// The listener is set up ONCE per app lifetime, not per component instance.
// Uses matchMedia('(pointer: coarse)') which is the standard way to detect touch
// devices without User-Agent sniffing.

import React from 'react';

// Evaluate once at module load time (safe because window.matchMedia is synchronous).
const mql =
  typeof window !== 'undefined'
    ? window.matchMedia('(pointer: coarse)')
    : null;

const initialMatches = mql?.matches ?? false;

export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = React.useState(initialMatches);

  React.useEffect(() => {
    if (!mql) return;
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isTouch;
}

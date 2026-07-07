'use client';

import React from 'react';

export interface Breakpoint {
  mobile: boolean;
  tablet: boolean;
  w: number;
}

export function useBreakpoint(): Breakpoint {
  const [w, setW] = React.useState(0);

  React.useEffect(() => {
    setW(window.innerWidth);
    let rafId: number | null = null;
    const h = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setW(window.innerWidth);
        rafId = null;
      });
    };
    window.addEventListener('resize', h);
    return () => {
      window.removeEventListener('resize', h);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return { mobile: w < 640, tablet: w < 1024, w };
}

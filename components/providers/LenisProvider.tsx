'use client';

import { ReactLenis } from 'lenis/react';
import type { ReactNode } from 'react';
import ScrollRestoration from './ScrollRestoration';
import { isOwnScroller } from '@/lib/scroll/is-own-scroller';


interface LenisProviderProps {
  children: ReactNode;
}

export default function LenisProvider({ children }: LenisProviderProps) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        prevent: isOwnScroller,
      }}
    >
      {/* INSIDE the provider, deliberately — it reads the Lenis instance
          through useLenis, which only resolves under ReactLenis. Lenis owns the
          root scroller, so scroll position on navigation is its job, not the
          browser's; see ScrollRestoration for why leaving it to either the
          browser or Next produced a page that opened halfway down. */}
      <ScrollRestoration />
      {children}
    </ReactLenis>
  );
}

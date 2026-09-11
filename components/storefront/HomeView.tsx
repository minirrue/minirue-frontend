'use client';

import React from 'react';
import type { ResolvedHome } from '@/lib/api/storefront';
import SectionRenderer from './SectionRenderer';
import { MARQUEE_HEIGHT } from '@/components/ui/Marquee';

export default function HomeView({
  home,
}: {
  home: ResolvedHome;
}) {
  const firstGridRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToProducts = () => {
    const el = firstGridRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  // The hero's "scroll" CTA targets the first product section below it,
  // whichever one the admin ordered there.
  const firstGridIndex = home.sections.findIndex((s) => s.type === 'productGrid');

  return (
    <main data-screen-label="Storefront · Home">
      {home.sections.map((section, index) => (
        <div key={section.id} ref={index === firstGridIndex ? firstGridRef : undefined}>
          <SectionRenderer
            section={section}
            onScrollToProducts={scrollToProducts}
            /*
             * A ribbon directly under the hero is part of the first screen, so
             * the hero gives up its height and the two together fill the
             * viewport. Owner: "if the marquee bar is under the hero consider
             * it inside the 100vh".
             *
             * Measured from the section list rather than assumed: a home page
             * that does not put a ribbon there gets a full-height hero, which
             * is the same rule with the offset at zero.
             */
            belowOffset={
              section.type === 'hero' &&
              home.sections[index + 1]?.type === 'ribbon'
                ? MARQUEE_HEIGHT
                : 0
            }
          />
        </div>
      ))}
    </main>
  );
}

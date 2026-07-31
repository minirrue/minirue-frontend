'use client';

import React from 'react';
import type { ResolvedHome } from '@/lib/api/storefront';
import SectionRenderer from './SectionRenderer';

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
          />
        </div>
      ))}
    </main>
  );
}

'use client';

import React from 'react';
import type { ApiProduct } from '@/lib/api/catalog';
import type { ResolvedSection } from '@/lib/api/storefront';
import Hero from './Hero';
import Marquee from '@/components/ui/Marquee';
import ProductGrid from './ProductGrid';
import EditorialBlock from './EditorialBlock';
import CollabShowcase from './CollabShowcase';

export default function SectionRenderer({
  section,
  onSelect,
  onScrollToProducts,
}: {
  section: ResolvedSection;
  onSelect: (product: ApiProduct) => void;
  onScrollToProducts: () => void;
}) {
  switch (section.type) {
    case 'hero':
      // A hero with no slides has nothing to show — the resolver keeps the
      // section, but rendering an empty carousel would leave a black band.
      if (section.slides.length === 0) return null;
      return (
        <Hero
          slides={section.slides}
          autoplayMs={section.autoplayMs}
          ariaLabel={section.ariaLabel}
          scrollCueLabel={section.scrollCueLabel}
          onShop={onScrollToProducts}
        />
      );

    case 'ribbon':
      if (section.items.length === 0) return null;
      return (
        <Marquee items={section.items} speed={section.speedSeconds} surface={section.surface} />
      );

    case 'productGrid':
      // A grid still shows its admin-authored eyebrow/title even with zero
      // items in the active display mode — only the empty item row omits
      // itself (ProductGrid renders no cards), so there is no blank band of
      // grid cells, but the header is never silently dropped.
      return (
        <ProductGrid
          eyebrow={section.eyebrow}
          title={section.title}
          viewAllHref={section.viewAllHref}
          products={section.products}
          brands={section.brands}
          display={section.display}
          onSelect={onSelect}
        />
      );

    case 'journal':
      return <EditorialBlock section={section} />;

    case 'collabShowcase':
      return <CollabShowcase section={section} onSelect={onSelect} />;

    default:
      return null;
  }
}

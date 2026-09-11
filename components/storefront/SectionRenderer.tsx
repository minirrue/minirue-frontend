'use client';

import React from 'react';
import type { ResolvedSection } from '@/lib/api/storefront';
import Hero from './Hero';
import Marquee from '@/components/ui/Marquee';
import ProductGrid from './ProductGrid';
import EditorialBlock from './EditorialBlock';
import CollabShowcase from './CollabShowcase';
import { SHOP_ALL } from '@/lib/routes';

/**
 * Carries a section's own headline to the page its "View all" opens.
 *
 * Tapping View all under "The Spring Edit" used to land on a page headed "All
 * Products", which reads as having gone somewhere other than where you clicked
 * (owner, 2026-08-21: "page name must be name of headline on view all"). The
 * destination reads `?collection=` and uses it as its heading.
 *
 * Only applied to the shop's own listing. A section may point its View all at
 * anything an admin configures — a partner space, a journal entry, an external
 * URL — and appending a query param to those would be meddling with a link this
 * component does not own.
 */
function withCollectionLabel(href: string | null, title: string): string | null {
  if (!href || !title.trim()) return href;
  const [path, existingQuery] = href.split('?');
  if (path !== SHOP_ALL) return href;
  const params = new URLSearchParams(existingQuery ?? '');
  // Never overwrite a label an admin set deliberately on the link itself.
  if (params.has('collection')) return href;
  params.set('collection', title.trim());
  return `${path}?${params.toString()}`;
}


export default function SectionRenderer({
  section,
  onScrollToProducts,
  belowOffset = 0,
}: {
  section: ResolvedSection;
  onScrollToProducts: () => void;
  /** Forwarded to the hero — see HeroProps.belowOffset. */
  belowOffset?: number;
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
          belowOffset={belowOffset}
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
          viewAllHref={withCollectionLabel(section.viewAllHref, section.title)}
          products={section.products}
          brands={section.brands}
          display={section.display}
        />
      );

    case 'journal':
      return <EditorialBlock section={section} />;

    case 'collabShowcase':
      return <CollabShowcase section={section} />;

    default:
      return null;
  }
}

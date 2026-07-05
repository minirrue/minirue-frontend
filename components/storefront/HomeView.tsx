'use client';

import React from 'react';
import type { ApiProduct } from '@/lib/api/catalog';
import Hero from './Hero';
import type { Slide } from './SlideContent';
import Marquee from '@/components/ui/Marquee';
import ProductGrid from './ProductGrid';
import EditorialBlock from './EditorialBlock';
import CollaboratorBrandsSection from './CollaboratorBrandsSection';

interface HomeViewProps {
  products: ApiProduct[];
  onSelect: (product: ApiProduct) => void;
  heroSlides?: Slide[];
  brandSections?: import('@/lib/api/collaborators').CollaboratorBrandSection[];
}

const MARQUEE_ITEMS = [
  'Worldwide shipping',
  "New S/S '26",
  'Complimentary samples',
  'Luxury packaging',
  'Duty-paid to 62 countries',
  'Private client service',
  'Free engraving',
];

export default function HomeView({ products, onSelect, heroSlides, brandSections = [] }: HomeViewProps) {
  const gridRef = React.useRef<HTMLDivElement | null>(null);

  const handleShop = () => {
    if (gridRef.current) {
      const y = gridRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <main data-screen-label="Storefront · Home">
      <Hero onShop={handleShop} slides={heroSlides} />
      <Marquee items={MARQUEE_ITEMS} />
      <div ref={gridRef}>
        <ProductGrid
          eyebrow="New arrivals · S/S '26"
          title="The Spring Edit"
          products={products.slice(0, 4)}
          onSelect={onSelect}
        />
      </div>
      <EditorialBlock />
      {brandSections.length > 0 && (
        <CollaboratorBrandsSection sections={brandSections} onSelect={onSelect} />
      )}
      <ProductGrid
        eyebrow="The house selection"
        title="From the Maison"
        products={products.slice(4, 8)}
        onSelect={onSelect}
      />
    </main>
  );
}

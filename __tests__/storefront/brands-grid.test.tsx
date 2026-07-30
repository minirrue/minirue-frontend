import React from 'react';
import { render, screen } from '@testing-library/react';
import BrandsGrid from '@/app/brands/BrandsGrid';
import type { PublicCollaboratorBrand } from '@/lib/api/collaborators';

/**
 * `/brands` — an index of partner spaces, each linking to `/{slug}` (the
 * root-level space route), not to a revived `/brands/[slug]`.
 */

const BRANDS: PublicCollaboratorBrand[] = [
  {
    collaboratorId: 'c1',
    brandSlug: 'helia',
    brandName: 'Helia',
    logoUrl: 'https://cdn.example.com/helia.png',
    description: null,
  },
  {
    collaboratorId: 'c2',
    brandSlug: 'atelier-x',
    brandName: 'Atelier X',
    logoUrl: null,
    description: null,
  },
];

describe('BrandsGrid', () => {
  it('links every brand to its root-level space, not /brands/<slug>', () => {
    render(<BrandsGrid brands={BRANDS} />);
    expect(screen.getByRole('link', { name: /helia/i })).toHaveAttribute('href', '/helia');
    expect(screen.getByRole('link', { name: /atelier x/i })).toHaveAttribute('href', '/atelier-x');
  });

  it('renders a name for every brand, with or without a logo', () => {
    render(<BrandsGrid brands={BRANDS} />);
    expect(screen.getByText('Helia')).toBeInTheDocument();
    expect(screen.getByText('Atelier X')).toBeInTheDocument();
  });

  it('shows an empty state rather than an empty grid when there are no brands', () => {
    render(<BrandsGrid brands={[]} />);
    expect(screen.getByText(/no brands yet/i)).toBeInTheDocument();
  });
});

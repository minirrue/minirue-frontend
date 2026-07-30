import React from 'react';
import { render, screen } from '@testing-library/react';
import CollabGrid from '@/app/collab/CollabGrid';
import type { PublicCollaboratorBrand } from '@/lib/api/collaborators';

/**
 * `/collab` — Task AA: an index of every partner MiniRue works with, cards
 * shaped from the collab's own logo, with rating + rating count + product
 * count, each linking to the partner's root-level space (`/{slug}`), never
 * `/collab/<slug>` or `/brands/<slug>`.
 */

const BRANDS: PublicCollaboratorBrand[] = [
  {
    collaboratorId: 'c1',
    brandSlug: 'helia',
    brandName: 'Helia',
    logoUrl: 'https://cdn.example.com/helia.png',
    description: null,
    productCount: 12,
    ratingAverage: 4.5,
    ratingCount: 20,
  },
  {
    collaboratorId: 'c2',
    brandSlug: 'atelier-x',
    brandName: 'Atelier X',
    logoUrl: null,
    description: null,
    productCount: 0,
    ratingAverage: null,
    ratingCount: 0,
  },
];

describe('CollabGrid', () => {
  it('links every card to its root-level space, not /collab/<slug> or /brands/<slug>', () => {
    render(<CollabGrid brands={BRANDS} />);
    expect(screen.getByRole('link', { name: /helia/i })).toHaveAttribute('href', '/helia');
    expect(screen.getByRole('link', { name: /atelier x/i })).toHaveAttribute(
      'href',
      '/atelier-x',
    );
  });

  it('shows the rating average and how many ratings it is built from', () => {
    render(<CollabGrid brands={BRANDS} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('20 ratings')).toBeInTheDocument();
  });

  it('shows "No ratings yet" for a collaborator nobody has rated, not a zero', () => {
    render(<CollabGrid brands={BRANDS} />);
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
  });

  it('shows how many products each collaborator has, singular vs plural', () => {
    render(<CollabGrid brands={BRANDS} />);
    expect(screen.getByText('12 products')).toBeInTheDocument();
    expect(screen.getByText('0 products')).toBeInTheDocument();
  });

  it('shows an empty state rather than an empty grid when there are no collaborators', () => {
    render(<CollabGrid brands={[]} />);
    expect(screen.getByText(/no collaborators yet/i)).toBeInTheDocument();
  });
});

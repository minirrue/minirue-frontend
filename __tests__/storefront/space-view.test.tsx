import React from 'react';
import { render, screen } from '@testing-library/react';
import type { StorefrontSpace, StorefrontSpaceBrand } from '@/lib/api/storefront';

/**
 * Task 7 — Generic is a collection, never a brand tile, and a partner's brand
 * tile must link inside its own space rather than out to the house listing.
 * `SpaceView` is an async Server Component (it fetches the Generic bucket's
 * own products), so it's exercised directly: `await SpaceView(props)`
 * resolves the element React would otherwise render on the server.
 */

const listProducts = jest.fn();

jest.mock('@/lib/api/catalog', () => ({
  catalog: {
    listProducts: (...args: unknown[]) => listProducts(...args),
  },
}));

import SpaceView from '@/app/[slug]/SpaceView';

const HELIA: StorefrontSpace = {
  id: 'space-1',
  slug: 'helia',
  name: 'Helia',
  kind: 'PARTNER',
  description: null,
  logoUrl: null,
};

const HOUSE: StorefrontSpace = {
  id: null,
  slug: '',
  name: 'MiniRue',
  kind: 'HOUSE',
  description: null,
  logoUrl: null,
};

function brand(overrides: Partial<StorefrontSpaceBrand>): StorefrontSpaceBrand {
  return {
    id: 'brand-1',
    slug: 'chanel',
    name: 'Chanel',
    description: null,
    imageUrl: null,
    isGeneric: false,
    ...overrides,
  };
}

describe('SpaceView — Generic as a collection, not a brand tile', () => {
  beforeEach(() => {
    listProducts.mockReset().mockResolvedValue({
      data: [],
      meta: { cursor: null, total: 0, hasMore: false },
    });
  });

  it('renders no tile for a Generic brand, and the word "Generic" never reaches the page', async () => {
    const brands: StorefrontSpaceBrand[] = [
      brand({ id: 'b-real', slug: 'chanel', name: 'Chanel', isGeneric: false }),
      brand({
        id: 'b-generic',
        slug: 'generic',
        name: 'Generic',
        description: 'A little of everything Helia carries.',
        isGeneric: true,
      }),
    ];

    const el = await SpaceView({ space: HELIA, categories: [], brands });
    render(el);

    expect(screen.queryByText(/generic/i)).not.toBeInTheDocument();
    expect(screen.getByText('More from Helia')).toBeInTheDocument();
    expect(screen.getByText('A little of everything Helia carries.')).toBeInTheDocument();
    // Only the real brand gets a tile link.
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toContain('/helia/chanel');
    expect(links.some((h) => h?.includes('generic'))).toBe(false);
  });

  it('links a partner brand tile inside its own space, not to the house /products listing', async () => {
    const brands = [brand({ id: 'b-real', slug: 'chanel', name: 'Chanel' })];
    const el = await SpaceView({ space: HELIA, categories: [], brands });
    render(el);

    const link = screen.getByRole('link', { name: /chanel/i });
    expect(link).toHaveAttribute('href', '/helia/chanel');
  });

  it('links a house brand tile to /products?brandId=<id>, scoped and not name-based', async () => {
    const brands = [brand({ id: 'brand-abc-123', slug: 'chanel', name: 'Chanel' })];
    const el = await SpaceView({ space: HOUSE, categories: [], brands });
    render(el);

    const link = screen.getByRole('link', { name: /chanel/i });
    expect(link).toHaveAttribute('href', '/products?brandId=brand-abc-123');
  });

  it('heads the house Generic section "MiniRue Selects"', async () => {
    const brands = [brand({ id: 'b-generic', isGeneric: true })];
    const el = await SpaceView({ space: HOUSE, categories: [], brands });
    render(el);

    expect(screen.getByText('MiniRue Selects')).toBeInTheDocument();
    expect(screen.queryByText(/generic/i)).not.toBeInTheDocument();
  });
});

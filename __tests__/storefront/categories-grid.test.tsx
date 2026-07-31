import React from 'react';
import { render, screen } from '@testing-library/react';
import CategoriesGrid from '@/app/categories/CategoriesGrid';
import type { Category } from '@/lib/api/catalog';

/**
 * `/categories` — Task AA: the mobile nav's Shop tab lands here. Real
 * categories from the catalogue, each shown as an image-led card, plus one
 * extra "All Products" card leading to the flat `/products` catalogue.
 */

const CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    slug: 'perfumes',
    name: 'Perfumes',
    parentId: null,
    imageUrl: 'https://cdn.example.com/perfumes.jpg',
  },
  {
    id: 'cat-2',
    slug: 'jewellery',
    name: 'Jewellery',
    parentId: null,
    imageUrl: null,
  },
];

describe('CategoriesGrid', () => {
  it('links every category to its own category page', () => {
    render(<CategoriesGrid categories={CATEGORIES} />);
    expect(screen.getByRole('link', { name: /perfumes/i })).toHaveAttribute(
      'href',
      '/categories/perfumes',
    );
    expect(screen.getByRole('link', { name: /jewellery/i })).toHaveAttribute(
      'href',
      '/categories/jewellery',
    );
  });

  it('always renders an extra "All Products" card leading to the flat catalogue', () => {
    render(<CategoriesGrid categories={CATEGORIES} />);
    expect(screen.getByRole('link', { name: /all products/i })).toHaveAttribute(
      'href',
      '/products',
    );
  });

  it('renders even with no categories, still showing the All Products card', () => {
    render(<CategoriesGrid categories={[]} />);
    expect(screen.getByRole('link', { name: /all products/i })).toBeInTheDocument();
  });

  // 2026-07-31 owner ask ("brand logo... like collab page"): this page IS the
  // "shop panel" the bottom nav's Shop tab opens, so MiniRue's own uploaded
  // logo belongs in its header the way a partner's belongs on their own
  // space page.
  describe('the shop logo', () => {
    it('renders the uploaded logo when the house space has one', () => {
      render(
        <CategoriesGrid
          categories={CATEGORIES}
          shopName="MiniRue"
          shopLogoUrl="https://cdn.example.com/house-logo.png"
        />,
      );
      const logo = screen.getByAltText('MiniRue');
      expect(logo.tagName).toBe('IMG');
      expect(logo).toHaveAttribute('src', 'https://cdn.example.com/house-logo.png');
      expect(screen.queryByTestId('shop-panel-logo-generic')).not.toBeInTheDocument();
    });

    it('falls back to the generic icon (no img, no initial letter) when no logo is uploaded', () => {
      render(<CategoriesGrid categories={CATEGORIES} shopName="MiniRue" shopLogoUrl={null} />);
      const fallback = screen.getByTestId('shop-panel-logo-generic');
      expect(fallback.querySelector('svg')).not.toBeNull();
      expect(fallback).toHaveTextContent('');
      // Only the "All Products"/category tiles may have <img>s (none do here,
      // since CATEGORIES includes one null-image category) — the logo slot
      // itself must never render a broken <img>.
      expect(screen.queryByAltText('MiniRue')).not.toBeInTheDocument();
    });
  });
});

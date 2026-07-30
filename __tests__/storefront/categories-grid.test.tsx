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
});

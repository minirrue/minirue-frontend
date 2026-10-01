import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import ProductCard from '@/components/storefront/ProductCard';
import CatalogProductCard from '@/components/storefront/CatalogProductCard';
import { PRODUCT_FIXTURE } from './fixtures/product';

/**
 * #204 — "All images must be 100% viewed, never cropped or zoomed." The
 * product cards drew a square packshot into a 3:4 / 4:5 tile with
 * `object-fit: cover` (about 78% of it visible) and zoomed it 4% on hover.
 * They now show the whole photo on the tile's own cream, at rest and on hover.
 */

jest.mock('@/lib/hooks/useIsTouch', () => ({ useIsTouch: () => false }));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/components/storefront/WishlistHeart', () => ({
  __esModule: true,
  default: () => null,
}));

function packshot(container: HTMLElement): HTMLImageElement {
  const img = container.querySelector('img');
  if (!img) throw new Error('no product image rendered');
  return img;
}

describe.each([
  ['ProductCard', ProductCard],
  ['CatalogProductCard', CatalogProductCard],
] as const)('%s — the whole packshot (#204)', (_name, Card) => {
  it('contains the photo instead of cropping it', () => {
    const { container } = render(<Card product={PRODUCT_FIXTURE} />);
    const img = packshot(container);
    expect(img.style.objectFit).toBe('contain');
  });

  it('does not zoom it on hover', () => {
    const { container } = render(<Card product={PRODUCT_FIXTURE} />);
    const link = container.querySelector('a') as HTMLElement;
    fireEvent.pointerEnter(link);
    fireEvent.mouseEnter(link);
    const img = packshot(container);
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.transform).not.toMatch(/scale/);
  });
});

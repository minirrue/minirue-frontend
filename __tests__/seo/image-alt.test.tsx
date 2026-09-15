import React from 'react';
import { render } from '@testing-library/react';
import SlideContent from '@/components/storefront/SlideContent';
import type { ResolvedHeroSlide, StorefrontSpace } from '@/lib/api/storefront';

/**
 * #155 — the SEO audit fails any content image in <main> whose alt is missing
 * or empty. The hero and the partner logo are content, so they always carry
 * alt text, even when an admin left the alt field blank.
 */

jest.mock('@/lib/api/catalog', () => ({
  catalog: {
    listProducts: jest.fn().mockResolvedValue({
      data: [],
      meta: { cursor: null, total: 0, hasMore: false },
    }),
  },
}));

import SpaceView from '@/app/collab/[slug]/SpaceView';

function slide(extra: Partial<ResolvedHeroSlide> = {}): ResolvedHeroSlide {
  return {
    id: 'slide-1',
    mode: 'image',
    eyebrow: 'EYEBROW',
    headline: 'Original\nPerfumes',
    sub: 'Sub',
    tagline: 'Tagline',
    imageUrl: 'https://img.minirueshop.com/hero.webp',
    mobileImageUrl: null,
    imageAlt: '',
    background: '#0B0B0B',
    bottle: null,
    cap: null,
    ctaLabel: 'Shop now',
    ctaTarget: { kind: 'scroll' },
    ctaHref: null,
    ...extra,
  };
}

function heroAlt(extra: Partial<ResolvedHeroSlide> = {}): string | null {
  const { container } = render(<SlideContent slide={slide(extra)} mobile={false} isActive />);
  return container.querySelector('img')!.getAttribute('alt');
}

describe('hero image alt', () => {
  it('uses the admin-authored alt when there is one', () => {
    expect(heroAlt({ imageAlt: 'A bottle of perfume' })).toBe('A bottle of perfume');
  });

  it('falls back to the headline, on one line, when the alt is blank', () => {
    expect(heroAlt({ imageAlt: '  ' })).toBe('Original Perfumes');
  });

  it('falls back to the brand when both are blank', () => {
    expect(heroAlt({ imageAlt: '', headline: '' })).toBe('MiniRue');
  });
});

describe('partner logo alt', () => {
  it('names the partner', async () => {
    const space: StorefrontSpace = {
      id: 'space-1',
      slug: 'helia',
      name: 'Helia',
      kind: 'PARTNER',
      description: null,
      logoUrl: 'https://img.minirueshop.com/helia.webp',
    };
    const el = await SpaceView({ space, categories: [], brands: [] });
    const { container } = render(el);
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img.getAttribute('alt')?.trim()).toBeTruthy();
    expect(imgs[0].getAttribute('alt')).toBe('Helia logo');
  });
});

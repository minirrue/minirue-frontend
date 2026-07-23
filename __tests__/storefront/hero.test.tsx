import React from 'react';
import { render, screen } from '@testing-library/react';
import Hero from '@/components/storefront/Hero';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';

/**
 * A live update (SSE/poll) can swap in a shorter `slides` array while Hero's
 * internal `current` index still points past the new end. `slides[current]`
 * then reads `undefined`, and SlideContent reading `.mode` off it used to
 * throw, white-screening the shop. Hero must clamp its effective index to
 * the current array bounds on every render instead.
 */

function makeSlide(id: string): ResolvedHeroSlide {
  return {
    id,
    mode: 'editorial',
    eyebrow: `eyebrow-${id}`,
    headline: `headline-${id}`,
    sub: '',
    tagline: '',
    imageUrl: null,
    imageAlt: '',
    background: '#0B0B0B',
    bottle: null,
    cap: null,
    ctaLabel: null,
    ctaTarget: { kind: 'scroll' },
    ctaHref: null,
  };
}

describe('Hero', () => {
  it('does not throw when re-rendered with fewer slides than the current index', () => {
    const threeSlides = [makeSlide('a'), makeSlide('b'), makeSlide('c')];
    const { rerender } = render(<Hero slides={threeSlides} autoplayMs={6000} />);

    // Navigate to the last slide (index 2) via the dot navigation.
    const dots = screen.getAllByRole('button', { name: /go to slide/i });
    dots[2].click();

    const oneSlide = [makeSlide('a')];
    expect(() => rerender(<Hero slides={oneSlide} autoplayMs={6000} />)).not.toThrow();

    // The clamped index (0) is rendered, not a crash.
    expect(screen.getAllByText('headline-a').length).toBeGreaterThan(0);
  });

  it('renders nothing for an empty slides array instead of throwing', () => {
    const { container } = render(<Hero slides={[]} autoplayMs={6000} />);
    expect(container.querySelector('section')).toBeNull();
  });
});

import React from 'react';
import { act, render, screen } from '@testing-library/react';
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
    mobileImageUrl: null,
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
  describe('pause on hover (frontend#81)', () => {
    // React synthesises pointerenter from `pointerover`; jsdom has no
    // PointerEvent, so the pointer type is stamped on a plain event.
    function pointerOver(el: Element, pointerType: string) {
      const e = new Event('pointerover', { bubbles: true });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      act(() => { el.dispatchEvent(e); });
    }

    let cancel: jest.SpyInstance;
    beforeEach(() => {
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
      cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('keeps the carousel running when a finger taps the hero', () => {
      const { container } = render(<Hero slides={[makeSlide('a'), makeSlide('b')]} autoplayMs={6000} />);
      cancel.mockClear();
      pointerOver(container.querySelector('section')!, 'touch');
      expect(cancel).not.toHaveBeenCalled();
    });

    it('still pauses for a mouse', () => {
      const { container } = render(<Hero slides={[makeSlide('a'), makeSlide('b')]} autoplayMs={6000} />);
      cancel.mockClear();
      pointerOver(container.querySelector('section')!, 'mouse');
      expect(cancel).toHaveBeenCalled();
    });
  });
});

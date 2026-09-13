import React from 'react';
import { render } from '@testing-library/react';
import SlideContent from '@/components/storefront/SlideContent';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';

/**
 * The browser, not `useBreakpoint`, picks the hero crop (#11).
 *
 * `useBreakpoint` starts at width 0, so the server render — and the first
 * client render — treats every visitor as a phone. When the crop followed
 * `mobile`, a desktop visitor's HTML carried and preloaded the portrait crop,
 * and the landscape image (the real LCP) was only requested after hydration.
 * Measured on minirueshop.com at 1440x900: 401 KB of phone crop downloaded
 * first, the 439 KB desktop crop started 4-7 s in.
 *
 * So the markup must be the SAME whatever `mobile` says, with each crop behind
 * a media query. That invariant is what these pin.
 */

const PHONE_MEDIA = '(max-width: 639.98px)';

const slide = (extra: Partial<ResolvedHeroSlide> = {}): ResolvedHeroSlide => ({
  id: 's1',
  mode: 'image',
  eyebrow: 'E',
  headline: 'H',
  sub: 'S',
  tagline: 'T',
  imageUrl: 'https://img.test/landscape-2560.webp',
  imageSrcSet: {
    '640': 'https://img.test/landscape-640.webp',
    '2560': 'https://img.test/landscape-2560.webp',
  },
  mobileImageUrl: 'https://img.test/portrait-2560.webp',
  mobileImageSrcSet: {
    '640': 'https://img.test/portrait-640.webp',
    '2560': 'https://img.test/portrait-2560.webp',
  },
  imageAlt: 'Spring campaign',
  background: '#0B0B0B',
  bottle: null,
  cap: null,
  ctaLabel: null,
  ctaTarget: { kind: 'scroll' },
  ctaHref: null,
  ...extra,
});

const heroMarkup = (container: HTMLElement) => container.querySelector('picture')?.outerHTML;

describe('hero art direction', () => {
  it('renders identical markup whether or not the component believes it is on a phone', () => {
    // This is the whole fix: the server always renders with mobile=true, so
    // anything that differs between these two renders is a double download.
    const asPhone = render(<SlideContent slide={slide()} mobile isActive />);
    const asDesktop = render(<SlideContent slide={slide()} mobile={false} isActive />);

    expect(heroMarkup(asPhone.container)).toBeDefined();
    expect(heroMarkup(asPhone.container)).toBe(heroMarkup(asDesktop.container));
  });

  it('puts the portrait crop behind the phone media query and the landscape crop on the img', () => {
    const { container } = render(<SlideContent slide={slide()} mobile isActive />);
    const source = container.querySelector('picture > source');
    const img = container.querySelector('picture > img');

    expect(source?.getAttribute('media')).toBe(PHONE_MEDIA);
    expect(source?.getAttribute('srcset')).toContain('portrait-640.webp 640w');
    expect(source?.getAttribute('srcset')).not.toContain('landscape');
    expect(source?.getAttribute('sizes')).toBe('100vw');

    expect(img?.getAttribute('srcset')).toContain('landscape-640.webp 640w');
    expect(img?.getAttribute('srcset')).not.toContain('portrait');
    expect(img?.getAttribute('alt')).toBe('Spring campaign');
  });

  it('keeps the LCP hints the single-image hero had', () => {
    const { container } = render(<SlideContent slide={slide()} mobile isActive />);
    const img = container.querySelector('picture > img');

    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
    expect(img?.className).toContain('mr-hero-drift');
  });

  it('matches useBreakpoint exactly: 639px is a phone, 640px is not', () => {
    // useBreakpoint: `mobile: w < 640`. The Tailwind `max-sm` variant used for
    // object-position is `width < 40rem`, i.e. the same line.
    expect(PHONE_MEDIA).toBe('(max-width: 639.98px)');
    const { container } = render(<SlideContent slide={slide()} mobile isActive />);
    expect(container.querySelector('picture > img')?.className).toMatch(/max-sm:object-\[50%_50%\]/);
  });

  it('falls back to one file per crop when the server sent no widths', () => {
    const { container } = render(
      <SlideContent slide={slide({ imageSrcSet: null, mobileImageSrcSet: undefined })} mobile isActive />,
    );
    const source = container.querySelector('picture > source');
    const img = container.querySelector('picture > img');

    expect(source?.getAttribute('srcset')).toBe('https://img.test/portrait-2560.webp');
    expect(source?.hasAttribute('sizes')).toBe(false);
    expect(img?.getAttribute('src')).toBe('https://img.test/landscape-2560.webp');
  });

  it('is not used without a phone crop — one image serves every screen, as before', () => {
    const { container } = render(<SlideContent slide={slide({ mobileImageUrl: null })} mobile isActive />);
    expect(container.querySelector('picture')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('srcset')).toContain('landscape-640.webp');
  });

  it('is not used when either crop is a video — that path needs JavaScript anyway', () => {
    const { container } = render(
      <SlideContent slide={slide({ mediaKind: 'video', posterUrl: null })} mobile={false} isActive />,
    );
    expect(container.querySelector('picture')).toBeNull();
  });
});

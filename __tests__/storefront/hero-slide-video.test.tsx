import React from 'react';
import { render } from '@testing-library/react';
import SlideContent from '@/components/storefront/SlideContent';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';

/**
 * Video in the hero (minirue-backend#89, slice 3).
 *
 * The issue set the rules up front and these pin each one: muted (or browsers
 * will not autoplay), `prefers-reduced-motion` respected, a poster painted
 * first, and — because the carousel mounts every slide on a page #7 measured as
 * bandwidth-bound — only the slide on screen loads or plays.
 */

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const videoSlide = (extra: Partial<ResolvedHeroSlide> = {}): ResolvedHeroSlide => ({
  id: 's1',
  mode: 'image',
  eyebrow: 'E',
  headline: 'H',
  sub: 'S',
  tagline: 'T',
  imageUrl: 'https://s3.test/clip.mp4?signed',
  imageSrcSet: null,
  mobileImageUrl: null,
  mediaKind: 'video',
  posterUrl: 'https://img.test/poster.webp',
  imageAlt: 'Campaign film',
  background: '#0B0B0B',
  bottle: null,
  cap: null,
  ctaLabel: 'Shop',
  ctaTarget: { kind: 'scroll' },
  ctaHref: null,
  ...extra,
});

const original = window.matchMedia;
let play: jest.SpyInstance;

beforeEach(() => {
  setReducedMotion(false);
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  window.matchMedia = original;
  jest.restoreAllMocks();
});

describe('hero video', () => {
  it('plays the active slide muted, looping and inline, with its poster', () => {
    const { container } = render(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    const video = container.querySelector('video') as HTMLVideoElement;

    expect(video).not.toBeNull();
    // Assigned once by the effect, not rendered as a prop — see HeroVideo.
    expect(video.getAttribute('src')).toBe('https://s3.test/clip.mp4?signed');
    expect(video.preload).toBe('auto');
    expect(video).toHaveAttribute('poster', 'https://img.test/poster.webp');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video).toHaveAttribute('playsinline');
    expect(play).toHaveBeenCalledTimes(1);
    // Never painted into an image tag.
    expect(container.querySelector('img[src*="clip.mp4"]')).toBeNull();
  });

  it('assigns the source once, not again on re-render', () => {
    const { container, rerender } = render(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    const video = container.querySelector('video') as HTMLVideoElement;
    const setSrc = jest.spyOn(video, 'src', 'set');

    rerender(<SlideContent slide={videoSlide()} mobile={false} isActive />);

    // A second assignment restarts the download — the bug this shape exists to avoid.
    expect(setSrc).not.toHaveBeenCalled();
  });

  it('gives a slide that is not on screen no source to fetch', () => {
    const { container } = render(<SlideContent slide={videoSlide()} mobile={false} isActive={false} />);
    const video = container.querySelector('video') as HTMLVideoElement;

    expect(video).not.toHaveAttribute('src');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).not.toHaveAttribute('autoplay');
    expect(play).not.toHaveBeenCalled();
  });

  it('loads and plays a slide when it becomes the active one', () => {
    const { container, rerender } = render(
      <SlideContent slide={videoSlide()} mobile={false} isActive={false} />,
    );
    rerender(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    const video = container.querySelector('video') as HTMLVideoElement;

    expect(video.getAttribute('src')).toBe('https://s3.test/clip.mp4?signed');
    expect(play).toHaveBeenCalled();
  });

  it('shows the poster as a still and no video under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const { container } = render(<SlideContent slide={videoSlide()} mobile={false} isActive />);

    expect(container.querySelector('video')).toBeNull();
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toContain('poster.webp');
    expect(play).not.toHaveBeenCalled();
  });

  it('uses the desktop kind on a phone that has no mobile crop', () => {
    // heroSrc falls back to the desktop media, so the kind must follow it.
    const { container } = render(
      <SlideContent slide={videoSlide({ mobileMediaKind: 'image', mobilePosterUrl: null })} mobile isActive />,
    );

    expect(container.querySelector('video')).not.toBeNull();
  });

  it('shows a mobile photo crop as a photo even when desktop is a video', () => {
    const { container } = render(
      <SlideContent
        slide={videoSlide({
          mobileImageUrl: 'https://img.test/portrait.webp',
          mobileMediaKind: 'image',
          mobilePosterUrl: null,
        })}
        mobile
        isActive
      />,
    );

    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toContain('portrait.webp');
  });

  it('renders a photo slide as before, including from a backend that sends no kind', () => {
    const { container } = render(
      <SlideContent
        slide={videoSlide({ imageUrl: 'https://img.test/photo.webp', mediaKind: undefined, posterUrl: undefined })}
        mobile={false}
        isActive
      />,
    );

    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toContain('photo.webp');
  });
});

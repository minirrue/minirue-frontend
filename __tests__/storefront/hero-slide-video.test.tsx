import React from 'react';
import { act, render, screen } from '@testing-library/react';
import SlideContent from '@/components/storefront/SlideContent';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';
import { installMockIO, scrollAllIntoView } from './fixtures/intersection-observer';

/**
 * Video in the hero (minirue-backend#89, slice 3), played by the storefront
 * player (#135).
 *
 * The issue set the rules up front and these pin each one: muted (or browsers
 * will not autoplay), `prefers-reduced-motion` respected, a poster painted
 * first, and — because the carousel mounts every slide on a page #7 measured as
 * bandwidth-bound — only the slide on screen loads or plays. The player's own
 * behaviour is pinned in storefront-video.test.tsx; these pin the hero's use
 * of it.
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
let restoreIO: () => void;

beforeEach(() => {
  restoreIO = installMockIO();
  setReducedMotion(false);
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  restoreIO();
  window.matchMedia = original;
  jest.restoreAllMocks();
});

describe('hero video', () => {
  it('plays the active slide muted, looping and inline, with its poster and the ring control', () => {
    const { container } = render(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    act(() => scrollAllIntoView());
    const video = container.querySelector('video') as HTMLVideoElement;

    expect(video).not.toBeNull();
    // Assigned once by the player's effect, not rendered as a prop (lesson #91).
    expect(video.getAttribute('src')).toBe('https://s3.test/clip.mp4?signed');
    expect(video.preload).toBe('auto');
    expect(video).toHaveAttribute('poster', 'https://img.test/poster.webp');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('controls');
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /video/ })).toBeInTheDocument();
    // Never painted into an image tag.
    expect(container.querySelector('img[src*="clip.mp4"]')).toBeNull();
  });

  it('assigns the source once, not again on re-render', () => {
    const { container, rerender } = render(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    act(() => scrollAllIntoView());
    const video = container.querySelector('video') as HTMLVideoElement;
    const setSrc = jest.spyOn(video, 'src', 'set');

    rerender(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    act(() => scrollAllIntoView());

    // A second assignment restarts the download — the bug this shape exists to avoid.
    expect(setSrc).not.toHaveBeenCalled();
  });

  it('gives a slide that is not on screen no source to fetch', () => {
    const { container } = render(<SlideContent slide={videoSlide()} mobile={false} isActive={false} />);
    act(() => scrollAllIntoView());
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
    act(() => scrollAllIntoView());
    rerender(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    const video = container.querySelector('video') as HTMLVideoElement;

    expect(video.getAttribute('src')).toBe('https://s3.test/clip.mp4?signed');
    expect(play).toHaveBeenCalled();
  });

  it('shows the poster and a play button, and loads nothing, under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const { container } = render(<SlideContent slide={videoSlide()} mobile={false} isActive />);
    act(() => scrollAllIntoView());

    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).toHaveAttribute('poster', 'https://img.test/poster.webp');
    expect(video).not.toHaveAttribute('src');
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /video/ })).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toContain('photo.webp');
  });
});

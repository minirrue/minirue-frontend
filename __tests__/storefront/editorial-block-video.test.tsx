import React from 'react';
import { act, render, screen } from '@testing-library/react';
import EditorialBlock from '@/components/storefront/EditorialBlock';
import type { ResolvedSection } from '@/lib/api/storefront';
import { installMockIO, nearObserver, viewObserver } from './fixtures/intersection-observer';

/**
 * A journal block can hold a video (backend#89).
 *
 * The dashboard's gallery picker always offered videos, and the backend
 * resolved one to a signed movie URL — which this block then painted into an
 * image tag. It plays it now, through the storefront player (#135): the owner
 * wants every storefront video to start on its own like apple.com's.
 *
 * That reverses this block's earlier "the shopper presses play" rule, whose
 * reason was bandwidth: the block sits below the fold on a page #7 measured as
 * bandwidth-bound. The player keeps that reason intact — nothing but the poster
 * loads until the block is near the viewport — and that is what is pinned here.
 */

type Journal = Extract<ResolvedSection, { type: 'journal' }>;

const base: Journal = {
  id: 'j1',
  type: 'journal',
  eyebrow: 'Journal',
  title: 'The making of',
  body: 'Words.',
  imageUrl: 'https://img.test/photo.webp',
  imageSide: 'left',
  badge: 'Editorial · N°4',
  ctaLabel: null,
  ctaHref: null,
};

const clip: Journal = {
  ...base,
  imageUrl: 'https://s3.test/clip.mp4?signed',
  mediaKind: 'video',
  posterUrl: 'https://img.test/clip-poster.webp',
};

let restoreIO: () => void;
let play: jest.SpyInstance;
beforeEach(() => {
  restoreIO = installMockIO();
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  restoreIO();
  jest.restoreAllMocks();
});

describe('EditorialBlock media', () => {
  it('shows a video poster-first, with the ring control and no browser controls', () => {
    const { container } = render(<EditorialBlock section={clip} />);

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('poster', 'https://img.test/clip-poster.webp');
    expect(video).not.toHaveAttribute('controls');
    // Below the fold on a bandwidth-bound page (#7): not a byte before it is near.
    expect(video).not.toHaveAttribute('src');
    expect(video).toHaveAttribute('preload', 'none');
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    // And the movie is never handed to an image element.
    expect(container.querySelector('img[src*="clip.mp4"]')).toBeNull();
  });

  it('loads when scrolled near, and plays once in view — without looping', () => {
    const { container } = render(<EditorialBlock section={clip} />);
    const video = container.querySelector('video') as HTMLVideoElement;

    act(() => nearObserver().fire(true));
    expect(video.getAttribute('src')).toBe('https://s3.test/clip.mp4?signed');
    expect(play).not.toHaveBeenCalled();

    act(() => viewObserver().fire(true));
    expect(play).toHaveBeenCalledTimes(1);
    expect(video.loop).toBe(false);
  });

  it('renders a photo as before, including from a backend that sends no kind', () => {
    // `mediaKind` absent is what a backend predating #89 sends.
    const { container } = render(<EditorialBlock section={base} />);

    expect(container.querySelector('video')).toBeNull();
    expect(screen.queryByRole('button', { name: /video/ })).toBeNull();
  });
});

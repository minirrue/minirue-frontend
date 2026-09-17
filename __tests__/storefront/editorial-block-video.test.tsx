import React from 'react';
import { render, screen } from '@testing-library/react';
import EditorialBlock from '@/components/storefront/EditorialBlock';
import type { ResolvedSection } from '@/lib/api/storefront';

/**
 * A journal block can hold a video (backend#89).
 *
 * The dashboard's gallery picker always offered videos, and the backend
 * resolved one to a signed movie URL — which this block then painted into an
 * image tag. It now plays it, and a photo block is untouched.
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

describe('EditorialBlock media', () => {
  it('renders the shared poster-first player with only its circular control', () => {
    const { container } = render(
      <EditorialBlock
        section={{
          ...base,
          imageUrl: 'https://s3.test/clip.mp4?signed',
          mediaKind: 'video',
          posterUrl: 'https://img.test/clip-poster.webp',
        }}
      />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('poster', 'https://img.test/clip-poster.webp');
    expect(video).not.toHaveAttribute('controls');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('preload', 'none');
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    // And the movie is never handed to an image element.
    expect(container.querySelector('img[src*="clip.mp4"]')).toBeNull();
  });

  it('still waits until near the viewport when there is no poster', () => {
    const { container } = render(
      <EditorialBlock
        section={{ ...base, imageUrl: 'https://s3.test/bare.mp4', mediaKind: 'video', posterUrl: null }}
      />,
    );

    expect(container.querySelector('video')).toHaveAttribute('preload', 'none');
    expect(container.querySelector('video')).not.toHaveAttribute('src');
  });

  it('renders a photo as before, including from a backend that sends no kind', () => {
    // `mediaKind` absent is what a backend predating #89 sends.
    const { container } = render(<EditorialBlock section={base} />);

    expect(container.querySelector('video')).toBeNull();
  });
});

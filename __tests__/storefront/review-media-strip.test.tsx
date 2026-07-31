import { render, screen } from '@testing-library/react';
import ReviewMediaStrip from '@/components/storefront/reviews/ReviewMediaStrip';
import type { ReviewMedia } from '@/lib/api/reviews';

/**
 * Task 41 (2026-07-31): a review video had no thumbnail — the browser drew
 * nothing until the customer pressed play. Fixed by resolving a poster frame
 * server-side (reviews.service.ts) and passing it through as the <video>'s
 * `poster` attribute here.
 */
describe('ReviewMediaStrip — video poster', () => {
  function videoMedia(overrides: Partial<ReviewMedia> = {}): ReviewMedia {
    return {
      id: 'media-1',
      kind: 'VIDEO',
      url: 'https://cdn.test/signed/clip.mp4',
      posterUrl: null,
      contentType: 'video/mp4',
      ...overrides,
    };
  }

  it('sets the resolved posterUrl as the video poster attribute', () => {
    render(
      <ReviewMediaStrip
        media={[videoMedia({ posterUrl: 'https://cdn.test/img/clip-poster.webp' })]}
      />,
    );
    const video = screen.getByLabelText('Video from a customer') as HTMLVideoElement;
    expect(video.poster).toBe('https://cdn.test/img/clip-poster.webp');
    expect(video.src).toBe('https://cdn.test/signed/clip.mp4');
  });

  it('leaves the poster attribute unset (never blank) when there is none', () => {
    render(<ReviewMediaStrip media={[videoMedia({ posterUrl: null })]} />);
    const video = screen.getByLabelText('Video from a customer') as HTMLVideoElement;
    expect(video.getAttribute('poster')).toBeNull();
  });
});

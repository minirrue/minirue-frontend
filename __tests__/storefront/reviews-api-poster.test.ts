import { apiAttachReviewMedia } from '@/lib/api/reviews';
import { apiFetch } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(),
}));

/**
 * Task 41 (2026-07-31): a video's poster is sent as a second multipart field
 * alongside the file itself, so the backend can store and later resolve it
 * exactly like a review photo.
 */
describe('apiAttachReviewMedia', () => {
  beforeEach(() => {
    (apiFetch as jest.Mock).mockReset().mockResolvedValue({ media: [] });
  });

  it('appends both the file and the poster when a poster is given', async () => {
    const file = new File(['clip'], 'clip.mp4', { type: 'video/mp4' });
    const poster = new Blob(['poster-bytes'], { type: 'image/jpeg' });

    await apiAttachReviewMedia('review-1', file, poster);

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = (apiFetch as jest.Mock).mock.calls[0];
    expect(path).toBe('/reviews/review-1/media');
    const form = init.body as FormData;
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('poster')).toBeInstanceOf(Blob);
  });

  it('sends no poster field at all when none is given (a photo attachment)', async () => {
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });

    await apiAttachReviewMedia('review-1', file);

    const [, init] = (apiFetch as jest.Mock).mock.calls[0];
    const form = init.body as FormData;
    expect(form.get('poster')).toBeNull();
  });
});

import { capturePosterFrame } from '@/lib/media/capture-poster-frame';

/**
 * capturePosterFrame must never throw and never block a video upload — a
 * poster is a nice-to-have thumbnail, not the review itself (task 41,
 * 2026-07-31). jsdom has no real canvas 2D backend, so `getContext('2d')`
 * returns null here exactly like a browser environment would if canvas
 * support were ever unavailable — which conveniently exercises the same
 * "give up cleanly" path a real decode failure would take.
 *
 * The <video> element is never appended to the document (the real
 * implementation doesn't either), so it's captured straight off
 * `document.createElement` rather than queried back out of the tree. The
 * capture is available synchronously the moment `capturePosterFrame` is
 * called — an async function body runs synchronously up to its first
 * `await`, and `document.createElement('video')` is the very first thing it
 * does.
 */
function captureVideoElement(): { video: () => HTMLVideoElement } {
  const realCreateElement = document.createElement.bind(document);
  let captured: HTMLVideoElement | null = null;
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreateElement(tag as never);
    if (tag === 'video') captured = el as HTMLVideoElement;
    return el;
  });
  return {
    video: () => {
      if (!captured) throw new Error('video element was never created');
      return captured;
    },
  };
}

describe('capturePosterFrame', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves null (never throws) when the video errors before metadata loads', async () => {
    const { video } = captureVideoElement();
    const file = new File(['not-a-real-video'], 'clip.mp4', { type: 'video/mp4' });

    const promise = capturePosterFrame(file);
    video().dispatchEvent(new Event('error'));

    await expect(promise).resolves.toBeNull();
  });

  it('resolves null (never throws) when canvas 2D context is unavailable', async () => {
    const { video } = captureVideoElement();
    const file = new File(['not-a-real-video'], 'clip.mp4', { type: 'video/mp4' });

    const promise = capturePosterFrame(file);
    Object.defineProperty(video(), 'duration', { value: 4, configurable: true });
    video().dispatchEvent(new Event('loadedmetadata'));
    await Promise.resolve();

    video().dispatchEvent(new Event('seeked'));

    // jsdom's canvas has no 2D backend installed — getContext('2d') is null,
    // which is the same "cannot capture" shape a real browser failure takes.
    await expect(promise).resolves.toBeNull();
  });
});

import { renderHook, act } from '@testing-library/react';
import { useImageRetry } from '@/lib/hooks/useImageRetry';

/**
 * 2026-08-01 — product cards had no `onError` handler at all, so one failed
 * load left the browser's broken-image icon on the card for the rest of the
 * page's life. ProductCard already had a graceful placeholder (the product
 * name); it was only ever reached when a product had NO image, never when one
 * failed to load.
 */
describe('useImageRetry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('passes a healthy image straight through', () => {
    const { result } = renderHook(() => useImageRetry('https://img.example/a.webp'));
    expect(result.current.src).toBe('https://img.example/a.webp');
    expect(result.current.failed).toBe(false);
  });

  it('shows the placeholder immediately on failure, not a broken frame', () => {
    const { result } = renderHook(() => useImageRetry('https://img.example/a.webp'));
    act(() => result.current.onError());
    expect(result.current.failed).toBe(true);
  });

  it('retries with a cache-busting suffix after backing off', () => {
    const { result } = renderHook(() => useImageRetry('https://img.example/a.webp'));
    act(() => result.current.onError());
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.src).toBe('https://img.example/a.webp?retry=1');
  });

  it('uses & when the url already has a query string', () => {
    const { result } = renderHook(() => useImageRetry('https://img.example/a.webp?sig=x'));
    act(() => result.current.onError());
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.src).toBe('https://img.example/a.webp?sig=x&retry=1');
  });

  /**
   * The bug this hook could easily have shipped with: the caller renders its
   * placeholder INSTEAD of the image while `failed`, so if `failed` stayed
   * true the retry would point at a URL nothing was left to request. The
   * image could then never return — a retry loop that cannot succeed.
   */
  it('clears failed when the retry fires, so there is something left to load it', () => {
    const { result } = renderHook(() => useImageRetry('https://img.example/a.webp'));
    act(() => result.current.onError());
    expect(result.current.failed).toBe(true);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.failed).toBe(false);
  });

  it('puts the picture back the moment a retry lands', () => {
    const { result } = renderHook(() => useImageRetry('https://img.example/a.webp'));
    act(() => result.current.onError());
    act(() => result.current.onLoad());
    expect(result.current.failed).toBe(false);
  });

  it('stops retrying eventually rather than hammering a genuinely missing object', () => {
    const { result } = renderHook(() => useImageRetry('https://img.example/a.webp', 2));
    act(() => result.current.onError());
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => result.current.onError()); // second and final attempt
    const after = result.current.src;
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current.src).toBe(after);
    expect(result.current.failed).toBe(true);
  });

  it('resets completely when the card is given a different product image', () => {
    const { result, rerender } = renderHook(({ src }) => useImageRetry(src), {
      initialProps: { src: 'https://img.example/a.webp' },
    });
    act(() => result.current.onError());
    rerender({ src: 'https://img.example/b.webp' });
    expect(result.current.src).toBe('https://img.example/b.webp');
    expect(result.current.failed).toBe(false);
  });
});

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StorefrontVideo from '@/components/storefront/StorefrontVideo';
import { controlLabel, ringOffset } from '@/lib/media/storefront-video';
import { installMockIO, nearObserver, viewObserver } from './fixtures/intersection-observer';

/**
 * The Apple-style storefront player (#135): autoplaying, muted, inline, and
 * the ONLY control is a small progress ring with pause / play / replay in its
 * centre. These pin the behaviour the issue lists — progress maths, the three
 * states, reduced motion, and loading only near / playing only in view.
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

const originalMatchMedia = window.matchMedia;
let play: jest.SpyInstance;
let pause: jest.SpyInstance;
let restoreIO: () => void;

beforeEach(() => {
  restoreIO = installMockIO();
  setReducedMotion(false);
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  });
  pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });
});

afterEach(() => {
  restoreIO();
  window.matchMedia = originalMatchMedia;
  jest.restoreAllMocks();
});

const SRC = 'https://s3.test/clip.mp4?signed';
const renderPlayer = (props: Partial<React.ComponentProps<typeof StorefrontVideo>> = {}) =>
  render(
    <div style={{ position: 'relative' }}>
      <StorefrontVideo src={SRC} poster="https://img.test/poster.webp" label="Campaign film" {...props} />
    </div>,
  );
const video = (c: HTMLElement) => c.querySelector('video') as HTMLVideoElement;

describe('ring maths', () => {
  const C = 100;
  it('is empty at the start and full at the end', () => {
    expect(ringOffset(0, 10, C)).toBe(C);
    expect(ringOffset(10, 10, C)).toBe(0);
    expect(ringOffset(2.5, 10, C)).toBe(75);
  });
  it('never leaves the ring for a missing, zero or infinite duration, or a time past the end', () => {
    expect(ringOffset(3, NaN, C)).toBe(C);
    expect(ringOffset(3, 0, C)).toBe(C);
    expect(ringOffset(3, Infinity, C)).toBe(C);
    expect(ringOffset(12, 10, C)).toBe(0);
    expect(ringOffset(-1, 10, C)).toBe(C);
  });
  it('names the action the button will take', () => {
    expect(controlLabel('playing')).toBe('Pause video');
    expect(controlLabel('paused')).toBe('Play video');
    expect(controlLabel('ended')).toBe('Replay video');
  });
});

describe('StorefrontVideo', () => {
  it('renders poster-first: muted, inline, no controls, and no source until it is near the viewport', () => {
    const { container } = renderPlayer();
    const v = video(container);
    expect(v).toHaveAttribute('poster', 'https://img.test/poster.webp');
    expect(v.muted).toBe(true);
    expect(v).toHaveAttribute('playsinline');
    expect(v).not.toHaveAttribute('controls');
    expect(v).not.toHaveAttribute('src');
    expect(v).toHaveAttribute('preload', 'none');
    expect(play).not.toHaveBeenCalled();
  });

  it('assigns the source once when near, and plays only when in view', () => {
    const { container } = renderPlayer();
    const v = video(container);
    act(() => nearObserver().fire(true));
    expect(v.getAttribute('src')).toBe(SRC);
    expect(play).not.toHaveBeenCalled();

    act(() => viewObserver().fire(true));
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument();

    const setSrc = jest.spyOn(v, 'src', 'set');
    act(() => nearObserver().fire(true));
    act(() => viewObserver().fire(true));
    expect(setSrc).not.toHaveBeenCalled();
  });

  it('does not load for a zero-area touch — the next slide in a clipped gallery strip', () => {
    // Measured in Chrome: a gallery slide sitting just past the strip's edge is
    // reported `isIntersecting: true` with `intersectionRatio: 0`, and the
    // product clip downloaded at page load before anyone swiped to it.
    const { container } = renderPlayer();
    act(() => nearObserver().fire(true, 0));
    act(() => viewObserver().fire(true, 0));
    expect(video(container)).not.toHaveAttribute('src');
    expect(play).not.toHaveBeenCalled();
  });

  it('pauses when scrolled out of view and resumes when it comes back', () => {
    renderPlayer();
    act(() => nearObserver().fire(true));
    act(() => viewObserver().fire(true));
    act(() => viewObserver().fire(false));
    expect(pause).toHaveBeenCalled();
    act(() => viewObserver().fire(true));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('toggles pause and play from the button, and a shopper pause survives scrolling back', () => {
    renderPlayer();
    act(() => nearObserver().fire(true));
    act(() => viewObserver().fire(true));

    fireEvent.click(screen.getByRole('button', { name: 'Pause video' }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();

    act(() => viewObserver().fire(false));
    act(() => viewObserver().fire(true));
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(play).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument();
  });

  it('offers replay when a play-once clip ends, and replays from the start', () => {
    const { container } = renderPlayer();
    const v = video(container);
    act(() => nearObserver().fire(true));
    act(() => viewObserver().fire(true));
    act(() => {
      v.dispatchEvent(new Event('ended'));
    });
    const replay = screen.getByRole('button', { name: 'Replay video' });
    // jsdom's currentTime ignores writes, which would make the assertion below
    // pass with no rewind at all — so give the element a real one.
    Object.defineProperty(v, 'currentTime', { value: 4, writable: true, configurable: true });
    fireEvent.click(replay);
    expect(v.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('loops when asked to', () => {
    const { container } = renderPlayer({ loop: true });
    expect(video(container).loop).toBe(true);
  });

  it('shows a loading ring while the video is waiting for data', () => {
    const { container } = renderPlayer();
    const v = video(container);
    act(() => nearObserver().fire(true));
    act(() => viewObserver().fire(true));
    act(() => {
      v.dispatchEvent(new Event('waiting'));
    });
    expect(container.querySelector('[data-ring-loading]')).not.toBeNull();
    act(() => {
      v.dispatchEvent(new Event('playing'));
    });
    expect(container.querySelector('[data-ring-loading]')).toBeNull();
  });

  it('never starts itself under prefers-reduced-motion — poster and a play button, not a byte of video', () => {
    setReducedMotion(true);
    const { container } = renderPlayer();
    const v = video(container);
    act(() => nearObserver()?.fire(true));
    act(() => viewObserver()?.fire(true));
    expect(v).not.toHaveAttribute('src');
    expect(play).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(v.getAttribute('src')).toBe(SRC);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('an inactive player (a hero slide off screen) neither loads nor plays', () => {
    const { container, rerender } = render(
      <div>
        <StorefrontVideo src={SRC} poster={null} label="x" active={false} />
      </div>,
    );
    act(() => nearObserver()?.fire(true));
    act(() => viewObserver()?.fire(true));
    expect(video(container)).not.toHaveAttribute('src');
    expect(play).not.toHaveBeenCalled();

    rerender(
      <div>
        <StorefrontVideo src={SRC} poster={null} label="x" active />
      </div>,
    );
    act(() => nearObserver().fire(true));
    act(() => viewObserver().fire(true));
    expect(video(container).getAttribute('src')).toBe(SRC);
    expect(play).toHaveBeenCalled();
  });

  it('does nothing when the video itself is clicked — only the button controls it', () => {
    const { container } = renderPlayer();
    act(() => nearObserver().fire(true));
    act(() => viewObserver().fire(true));
    pause.mockClear(); // mounting out of view pauses; only the click is under test
    fireEvent.click(video(container));
    fireEvent.pointerUp(video(container), { pointerType: 'touch' });
    expect(pause).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument();
  });

  it('keeps the poster up when the browser refuses to autoplay', async () => {
    play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    renderPlayer();
    act(() => nearObserver().fire(true));
    await act(async () => {
      viewObserver().fire(true);
    });
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
  });
});

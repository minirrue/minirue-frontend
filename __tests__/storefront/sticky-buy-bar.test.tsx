import React from 'react';
import { render as rtlRender, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import { PRODUCT_FIXTURE } from './fixtures/product';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function renderDetail() {
  return render(
    <ApiProductDetail
      product={PRODUCT_FIXTURE}
      perks={[]}
      onBack={() => {}}
      onAddToBag={() => {}}
    />,
  );
}

/**
 * W3.4 — two Add to bag buttons on screen at once. The sticky bar watches
 * the main (non-sticky) button with an IntersectionObserver and fades out
 * while it is visible, per components/storefront/ApiProductDetail.tsx.
 *
 * jest.setup.ts installs a global no-op IntersectionObserver so unrelated
 * tests don't crash; these tests replace it with a controllable double so
 * the entries callback can be driven by hand.
 */
interface Observation {
  callback: IntersectionObserverCallback;
  target: Element;
}

describe('sticky buy bar visibility (W3.4)', () => {
  let observations: Observation[];
  let realIO: typeof IntersectionObserver;

  beforeEach(() => {
    realIO = globalThis.IntersectionObserver;
    observations = [];

    // The product page also mounts a gallery and other components that use
    // their OWN IntersectionObservers (see jest.setup.ts). A single shared
    // "last callback wins" double is fragile — a later, unrelated observer
    // (e.g. the gallery's, mounted async via next/dynamic) can silently
    // steal the reference. Track {callback, target} pairs instead and pick
    // the one actually observing the main Add-to-bag button.
    const FakeIO = jest.fn(function (this: unknown, callback: IntersectionObserverCallback) {
      return {
        observe: (target: Element) => observations.push({ callback, target }),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
        takeRecords: () => [],
      };
    });
    // @ts-expect-error — test double, not a full IntersectionObserver
    globalThis.IntersectionObserver = FakeIO;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = realIO;
    jest.useRealTimers();
  });

  function mainButton(): Element {
    const el = document.querySelector(
      '[data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag"]',
    );
    if (!el) throw new Error('main Add to bag button not found');
    return el;
  }

  function fire(isIntersecting: boolean) {
    const button = mainButton();
    const observation = observations.find((o) => o.target === button);
    if (!observation) {
      throw new Error('main Add to bag button was never observed — check observations array');
    }
    act(() => {
      observation.callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
  }

  it('is visible before the observer reports anything', () => {
    renderDetail();
    const bar = screen.getByTestId('buy-bar');
    expect(bar.style.opacity).toBe('1');
  });

  it('hides while the main Add to bag button intersects the viewport', () => {
    renderDetail();
    const bar = screen.getByTestId('buy-bar');

    fire(true);

    expect(bar.style.opacity).toBe('0');
    expect(bar.getAttribute('aria-hidden')).toBe('true');
  });

  it('comes back once the main button leaves the viewport', () => {
    renderDetail();
    const bar = screen.getByTestId('buy-bar');

    fire(true);
    expect(bar.style.opacity).toBe('0');

    fire(false);
    expect(bar.style.opacity).toBe('1');
    expect(bar.getAttribute('aria-hidden')).toBe('false');
  });

  it('SAFETY: stays visible forever if the observer never fires', () => {
    jest.useFakeTimers();
    renderDetail();
    const bar = screen.getByTestId('buy-bar');

    expect(bar.style.opacity).toBe('1');
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // No entries callback ever ran (ioCallback is still unused here) — the
    // bar must not end up hidden just because time passed.
    expect(bar.style.opacity).toBe('1');
  });

  it('SAFETY: an observed-true state is not later reverted by the safety timer', () => {
    jest.useFakeTimers();
    renderDetail();
    const bar = screen.getByTestId('buy-bar');

    fire(true);
    expect(bar.style.opacity).toBe('0');

    // The safety fallback only applies when the observer never reports at
    // all — a genuine "main button visible" state must not be clobbered
    // back to visible just because 1.5s elapsed.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(bar.style.opacity).toBe('0');
  });
});

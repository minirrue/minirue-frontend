import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { CartProvider } from '@/components/storefront/cart/CartContext';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// CartProvider hydrates via a real fetch on mount (see CartContext.tsx). Not
// under test here — stub it so it resolves to an empty, predictable cart
// instead of failing/rejecting per test.
jest.mock('@/lib/api/cart', () => ({
  EMPTY_CART: { id: '', items: [], totals: { subtotalAmount: '0', itemCount: 0 }, currency: 'USD' },
  apiGetCart: jest.fn().mockResolvedValue({
    id: 'cart-1',
    items: [],
    totals: { subtotalAmount: '0', itemCount: 0 },
    currency: 'USD',
  }),
  apiAddItem: jest.fn(),
  apiUpdateItem: jest.fn(),
  apiRemoveItem: jest.fn(),
  apiClearCart: jest.fn(),
  getCartSessionId: jest.fn().mockReturnValue(null),
}));

function renderNav() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CartProvider>
        <MobileBottomNav />
      </CartProvider>
    </QueryClientProvider>,
  );
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

// useScrollDirection throttles its scroll sampling behind requestAnimationFrame
// (that's the point of it — see the hook). jsdom's rAF runs on a real timer, so
// without this it never fires inside a synchronous `act()` block. Running the
// callback immediately keeps these tests synchronous and deterministic.
beforeAll(() => {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
});

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

function bar(): HTMLElement {
  return screen.getByTestId('mobile-bottom-nav');
}

/**
 * `computeAtBottom` (useScrollDirection.ts) reads `document.documentElement.
 * scrollHeight` and `window.innerHeight` — jsdom never lays anything out, so
 * both default to values that don't represent a real page. Mock both so the
 * "at the very bottom" tests below are exercising real arithmetic, not jsdom
 * defaults.
 */
function mockPageMetrics({ scrollHeight, innerHeight }: { scrollHeight: number; innerHeight: number }) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
}

describe('MobileBottomNav (W4a.2)', () => {
  afterEach(() => {
    setViewportWidth(1024);
  });

  it('is hidden (display: none) at >= 1024px', () => {
    setViewportWidth(1280);
    renderNav();
    expect(bar().style.display).toBe('none');
  });

  it('is present (display: flex) below 1024px', () => {
    setViewportWidth(800);
    renderNav();
    expect(bar().style.display).toBe('flex');
  });

  it('does not flip on a sub-threshold move', () => {
    setViewportWidth(600);
    renderNav();
    // Establish a clear upward (hidden) state first, away from the top zone
    // so a further small downward nudge is the only thing under test.
    scrollTo(300);
    scrollTo(500);
    scrollTo(400); // a real upward move — direction flips to 'up', bar hides
    expect(bar().style.transform).toBe('translateY(100%)');
    scrollTo(403); // +3px — below the ~8px threshold; without it this alone
    // would read as "scrolling down" and flip the bars right back.
    expect(bar().style.transform).toBe('translateY(100%)');
  });

  it('slides in on scroll down past the threshold, and the top bar (site header) would hide — verified via the shared hook contract', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(100);
    scrollTo(140); // well past threshold, moving down
    expect(bar().style.transform).toBe('translateY(0)');
  });

  it('reverses on scroll up', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(100);
    scrollTo(160); // down — bar visible
    expect(bar().style.transform).toBe('translateY(0)');
    scrollTo(80); // up past threshold — bar hides again
    expect(bar().style.transform).toBe('translateY(100%)');
  });

  it('shows the top bar (hides itself) at scroll position 0 regardless of prior direction', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(200);
    scrollTo(260); // scrolled down, bar visible
    expect(bar().style.transform).toBe('translateY(0)');
    scrollTo(0);
    expect(bar().style.transform).toBe('translateY(100%)');
  });

  it('reflects the cart item count as a badge on the Cart tab', async () => {
    setViewportWidth(600);
    renderNav();
    // Scroll down so the bar is actually shown. A hidden bar is now
    // `visibility: hidden`, which correctly takes it out of the accessibility
    // tree as well as out of sight — so `getByRole` cannot see it, and should
    // not: a bar the shopper cannot see is not one a screen reader should
    // announce either. Translating it off-screen alone used to leave it
    // exposed to assistive tech.
    scrollTo(100);
    scrollTo(160);
    // CartContext hydrates asynchronously; the mocked apiGetCart resolves
    // with itemCount 0, so no badge should render.
    await act(async () => {
      await Promise.resolve();
    });
    const cartButton = screen.getByRole('button', { name: /^Cart$/ });
    expect(cartButton.textContent).not.toMatch(/\d/);
  });

  it('applies no transition when prefers-reduced-motion is set', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    setViewportWidth(600);
    renderNav();
    expect(bar().style.transition).toBe('none');

    window.matchMedia = original;
  });
});

/**
 * Task 15a: the bar used to show whenever the page was scrolled and moving
 * down — but reaching the very bottom of a page IS a downward scroll, so it
 * was most visible exactly where it covers the footer. `useScrollDirection`'s
 * new `atBottom` flag fixes this without a second scroll listener.
 */
describe('MobileBottomNav — gets out of the way of the footer (Task 15a)', () => {
  afterEach(() => {
    mockPageMetrics({ scrollHeight: 0, innerHeight: 768 });
  });

  it('hides at the very bottom of the page so the footer is fully visible', () => {
    setViewportWidth(600);
    mockPageMetrics({ scrollHeight: 2600, innerHeight: 600 });
    renderNav();
    scrollTo(1500);
    scrollTo(2000); // scrolling down, and 2000 + 600 = 2600 — the very bottom
    expect(bar().style.transform).toBe('translateY(100%)');
  });

  it('still shows while scrolling down mid-page, well short of the bottom', () => {
    setViewportWidth(600);
    mockPageMetrics({ scrollHeight: 2600, innerHeight: 600 });
    renderNav();
    scrollTo(700);
    scrollTo(900); // scrolling down, but 900 + 600 = 1500 — nowhere near 2600
    expect(bar().style.transform).toBe('translateY(0)');
  });
});

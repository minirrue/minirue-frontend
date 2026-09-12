import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { CartProvider } from '@/components/storefront/cart/CartContext';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// This suite is about scroll/visibility behaviour, not auth — mock the
// avatar-related hooks to a signed-out shape so it never fires a real
// /auth/me or /customers/me request. See mobile-bottom-nav-avatar.test.tsx
// for the account-tab avatar behaviour itself.
jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: undefined, isLoading: false }),
}));
jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerProfile: () => ({ data: undefined }),
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

/**
 * A controllable clock for the hook's flip cooldown (#51).
 *
 * `useScrollDirection` refuses to change direction twice inside
 * `cooldownMs` (320ms by default) so the bars cannot be asked to reverse
 * while their own transition is still running. Everything in this file
 * happens inside a single synchronous tick, so without a clock every
 * scripted gesture after the first would land inside that window and be
 * deferred — the test would be measuring the cooldown rather than the thing
 * it means to test.
 *
 * Each `scrollTo` below is a separate DELIBERATE gesture, so the clock moves
 * past the cooldown between them. Sub-threshold nudges within one gesture use
 * `nudgeTo`, which does not advance it.
 */
let clockMs = 0;
let nowSpy: jest.SpyInstance<number, []>;
beforeAll(() => {
  nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => clockMs);
});
afterAll(() => nowSpy.mockRestore());
beforeEach(() => {
  clockMs = 0;
  // `window.scrollY` is a property on a shared window, so without this each
  // test inherits wherever the previous one left the page — and the hook
  // anchors to the scroll position it finds at mount, so that leak decides
  // whether the first gesture reads as up or down. Start every test at the top.
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

function dispatchScroll(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

/** A deliberate gesture: far enough apart in time to clear the flip cooldown. */
function scrollTo(y: number) {
  clockMs += 500;
  dispatchScroll(y);
}

/** A movement WITHIN one gesture — no time passes, as on a real finger. */
function nudgeTo(y: number) {
  dispatchScroll(y);
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
    nudgeTo(403); // +3px — nowhere near the 56px needed to claim "down".
    expect(bar().style.transform).toBe('translateY(100%)');
  });

  /**
   * #51, the actual report: "the upper navbar flashes many times under one
   * second when sliding slowly". A thumb roll-back on a Pixel 5 is ~11 CSS px
   * (≈5.6 CSS px per mm), which comfortably beat the hook's old symmetric 8px
   * threshold — so every wobble of a slow drag flipped both bars. The run's
   * EXTREME is the anchor now, so forward creep cannot walk the baseline up
   * behind the finger and a wobble is measured against how far the page has
   * really come.
   */
  it('ignores the roll-back of a slow thumb drag instead of strobing', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(200); // a decisive downward gesture — bar slides in
    expect(bar().style.transform).toBe('translateY(0)');

    // One slow drag: forward, forward, roll back 11px, forward… all inside the
    // same gesture, so no time passes and the cooldown is not what is being
    // tested here. The bar must not move once.
    let y = 200;
    for (let i = 0; i < 12; i++) {
      y += 13;
      nudgeTo(y);
      y += 13;
      nudgeTo(y);
      y -= 11;
      nudgeTo(y);
      expect(bar().style.transform).toBe('translateY(0)');
    }
  });

  it('slides in on scroll down past the threshold, and the top bar (site header) would hide — verified via the shared hook contract', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(100);
    scrollTo(200); // 100px down — past the 56px a decisive hide now demands
    expect(bar().style.transform).toBe('translateY(0)');
  });

  it('reverses on scroll up', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(100);
    scrollTo(200); // down — bar visible
    expect(bar().style.transform).toBe('translateY(0)');
    // Revealing is EAGER (24px, vs 56 to hide): a reader reaching back for the
    // top bar gets it after a flick, not after undoing the whole scroll.
    scrollTo(170);
    expect(bar().style.transform).toBe('translateY(100%)');
  });

  it('shows the top bar (hides itself) at scroll position 0 regardless of prior direction', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(200);
    scrollTo(300); // scrolled down, bar visible
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

  it('has no Home item and no Collab item, and keeps Shop linking to /shop', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(100);
    scrollTo(160); // scroll down so the bar is visible/in the a11y tree
    expect(screen.queryByRole('link', { name: /^Home$/ })).not.toBeInTheDocument();
    // #59 — Collab is out of this bar. The ROUTE is untouched; only the tab is
    // gone, so this asserts the absence of the tab, not of /collab.
    expect(screen.queryByRole('link', { name: /^Collab$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Shop$/ })).toHaveAttribute('href', '/shop');
  });

  it('is a deliberate four-tab bar: Search, Shop, Cart, account', () => {
    setViewportWidth(600);
    renderNav();
    const labels = screen
      .getAllByText(/^(Home|Menu|Search|Collab|Shop|Cart|Account)$/)
      .map((el) => el.textContent);
    // No Menu tab since 2026-08-21 — the header's account avatar opens the menu
    // sheet, so a second door labelled Menu did the same job twice. No Home tab
    // since 2026-07-30 — the logo already goes there. No Collab tab since #59.
    //
    // Four captions, not five with a hole: nothing was promoted into the slot
    // Collab vacated, because the only candidates are the two tabs the owner
    // had already asked to remove. This assertion is the guard against one of
    // them quietly coming back to "fill" it.
    //
    // Three captions for four tabs: the fourth is the account tab, which is a
    // photograph of the shopper and carries no word under it the way an outline
    // of a bag does. Its accessible name lives on the control — asserted in
    // 'makes the account tab a menu button' below, which scrolls the bar into
    // the a11y tree first.
    expect(labels).toEqual(['Search', 'Shop', 'Cart']);
  });

  it('makes the account tab a menu button, not a link to /account', () => {
    setViewportWidth(600);
    renderNav();
    // The bar is hidden until a scroll reveals it, same as the sibling tests.
    scrollTo(100);
    scrollTo(160);

    // Same face, same meaning, wherever it appears: the header avatar opens the
    // menu sheet and so does this one. Having it navigate instead would make
    // the identical control mean two different things depending on which end of
    // the screen it sat at.
    const account = screen.getByRole('button', { name: /account and menu/i });
    expect(account).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /account/i })).not.toBeInTheDocument();
  });

  it('sends Shop to the shop panel, not the flat product list', () => {
    setViewportWidth(600);
    renderNav();
    scrollTo(100);
    scrollTo(160);
    expect(screen.getByRole('link', { name: /^Shop$/ })).toHaveAttribute('href', '/shop');
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

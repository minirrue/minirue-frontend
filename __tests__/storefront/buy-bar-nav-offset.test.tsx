import React from 'react';
import { render as rtlRender, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { CartProvider } from '@/components/storefront/cart/CartContext';
import { PRODUCT_FIXTURE } from './fixtures/product';

/**
 * Bug 1 (task-storefront-bugs): the PDP sticky buy bar was rendering
 * UNDERNEATH the new mobile bottom nav. The fix is a measured CSS custom
 * property (`--mr-bottom-nav-offset`), written by MobileBottomNav.tsx onto
 * `document.documentElement` and read by the buy bar's own `bottom` — see
 * both files for the full rationale. These tests exercise that pipe from
 * both ends: the nav actually publishes 0 while hidden and its real height
 * while visible, and the buy bar's inline style is wired to consume exactly
 * that variable (plus the double-safe-area-padding fix layered on top).
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/products/some-product',
}));

// Not under test here — see mobile-bottom-nav-avatar.test.tsx for the
// account-tab avatar itself. Mocked signed-out so MobileBottomNav never
// fires a real /auth/me or /customers/me request in this suite.
jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: undefined, isLoading: false }),
}));
jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerProfile: () => ({ data: undefined }),
}));

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

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(
    <QueryClientProvider client={client}>
      <CartProvider>{ui}</CartProvider>
    </QueryClientProvider>,
  );
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

/**
 * One deliberate scroll gesture.
 *
 * The clock moves with it because `useScrollDirection` will not change
 * direction twice inside its flip cooldown (#51 — the bars must not be asked
 * to reverse while their own transition is still running). Every gesture in
 * this file happens inside one synchronous tick, so without advancing a clock
 * the second one would be deferred and this test would be measuring the
 * cooldown instead of the offset.
 */
let clockMs = 0;
let nowSpy: jest.SpyInstance<number, []>;
beforeAll(() => {
  nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => clockMs);
});
afterAll(() => nowSpy.mockRestore());
beforeEach(() => {
  clockMs = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

function scrollTo(y: number) {
  clockMs += 500;
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

afterEach(() => {
  setViewportWidth(1024);
  document.documentElement.style.removeProperty('--mr-bottom-nav-offset');
});

describe('mobile bottom nav offset — the buy bar stacking fix (Bug 1)', () => {
  let originalRaf: typeof window.requestAnimationFrame;
  let originalCaf: typeof window.cancelAnimationFrame;

  beforeAll(() => {
    // Same reasoning as mobile-bottom-nav.test.tsx: useScrollDirection
    // throttles behind rAF, which jsdom only ever fires on a real timer. Run
    // it inline so scroll-driven state updates land synchronously inside
    // act(). Scoped to THIS describe block only (MobileBottomNav, no motion
    // library involved) — the second describe below renders ApiProductDetail,
    // which drives its entrance animations through `motion`'s own rAF-based
    // frameloop, and forcing that to run synchronously recurses it into a
    // stack overflow.
    originalRaf = window.requestAnimationFrame;
    originalCaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = () => {};
  });

  afterAll(() => {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
  });

  it('publishes 0px while hidden and its real measured height while visible', () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    // jsdom never lays anything out, so the nav's real getBoundingClientRect()
    // is always a zero rect. Stub a realistic height so "measured, not
    // hardcoded" is actually observable in this test.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return {
        ...originalRect.call(this),
        height: 74,
      } as DOMRect;
    };

    try {
      setViewportWidth(600);
      renderWithProviders(<MobileBottomNav />);

      // At the very top of the page the nav is hidden (see useScrollDirection /
      // MobileBottomNav's `visible` rule) — the offset must be 0, not its
      // rendered-but-invisible height, or the buy bar would float above a gap.
      expect(
        document.documentElement.style.getPropertyValue('--mr-bottom-nav-offset'),
      ).toBe('0px');

      // Scroll down past the threshold — the nav slides on screen. 100px, not
      // the 40px this used to use: hiding the top bar now demands a decisive
      // 56px downward move (#51), because anything smaller is inside the noise
      // of a slow thumb drag.
      scrollTo(100);
      scrollTo(200);
      expect(
        document.documentElement.style.getPropertyValue('--mr-bottom-nav-offset'),
      ).toBe('74px');

      // Scroll back up — the nav hides again, offset must collapse back to 0
      // so the buy bar returns to the true bottom edge. Revealing is eager
      // (24px), so a 30px flick is enough and the shopper is not made to undo
      // the whole scroll to get the top bar back.
      scrollTo(170);
      expect(
        document.documentElement.style.getPropertyValue('--mr-bottom-nav-offset'),
      ).toBe('0px');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });
});

describe('sticky buy bar — consumes the measured offset (Bug 1)', () => {
  function renderDetail() {
    return renderWithProviders(
      <ApiProductDetail
        product={PRODUCT_FIXTURE}
        perks={[]}
        onBack={() => {}}
        onAddToBag={() => {}}
      />,
    );
  }

  it('sits its `bottom` on the shared --mr-bottom-nav-offset variable, not a hardcoded pixel value', () => {
    renderDetail();
    const bar = screen.getByTestId('buy-bar');
    expect(bar.style.bottom).toBe('var(--mr-bottom-nav-offset, 0px)');
  });

  it('adds its own safe-area padding only for the part the nav offset does not already cover', () => {
    renderDetail();
    const bar = screen.getByTestId('buy-bar');
    // When the nav is hidden, offset is 0 and this resolves to the full inset
    // (12px + the whole safe area). When the nav is visible, its own box
    // already carries the inset (folded into the measured offset), so
    // `max(0px, inset - offset)` collapses to 0 and this bar does not stack a
    // second copy of the same padding on top of it.
    expect(bar.style.paddingBottom).toBe(
      'calc(12px + max(0px, env(safe-area-inset-bottom) - var(--mr-bottom-nav-offset, 0px)))',
    );
  });
});

import React from 'react';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { CartProvider } from '@/components/storefront/cart/CartContext';

/**
 * Owner report: "you didnt put the avatar logo of the customer on far bottom
 * right mobile bottom navbar if the customer upaloded his avatar". The
 * account tab (far-right item) must show the customer's real uploaded photo
 * (customer_profiles.avatar_url, resolved server-side) when they have one,
 * the shared GenericAvatarIcon silhouette when they don't, and — the rule
 * the owner has repeated across five separate regressions (most recently
 * CollabShowcase.tsx) — NEVER a first-initial letter.
 *
 * Auth must be read live (`useUser()`, which masks `data` to undefined once
 * `/auth/me` has answered 401) rather than a stale localStorage snapshot, so
 * a signed-out visitor never inherits a previous account's photo.
 */

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
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

const mockUseUser = jest.fn();
const mockUseCustomerProfile = jest.fn();

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => mockUseUser(),
}));
jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerProfile: (...args: unknown[]) => mockUseCustomerProfile(...args),
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

function renderNav() {
  return render(
    <CartProvider>
      <MobileBottomNav />
    </CartProvider>,
  );
}

/** Makes the bar's account link/icon visible and part of the a11y tree,
 * same choreography as mobile-bottom-nav.test.tsx. */
function makeVisible() {
  scrollTo(100);
  scrollTo(160);
}

beforeAll(() => {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
});

beforeEach(() => {
  setViewportWidth(600);
  mockUseUser.mockReset();
  mockUseCustomerProfile.mockReset();
});

afterEach(() => {
  setViewportWidth(1024);
});

/**
 * The account tab became a menu BUTTON on 2026-08-21 — it opens the sheet
 * rather than navigating, matching the header avatar. Queried by label because
 * the bar sits at `visibility: hidden` until a scroll slides it in, so a role
 * query skips it; what these tests care about is what the tab RENDERS, which is
 * decided long before the shopper can see it.
 */
function accountLink(): HTMLElement {
  return screen.getByLabelText('Account and menu');
}

describe('MobileBottomNav — account tab avatar', () => {
  it('renders the customer photo when they have uploaded an avatar', async () => {
    mockUseUser.mockReturnValue({ data: { userId: 'cust-1', email: 'a@b.com' }, isLoading: false });
    mockUseCustomerProfile.mockReturnValue({
      data: { avatarUrl: 'https://cdn.example/avatars/cust-1.webp' },
    });

    renderNav();
    makeVisible();

    const img = screen.getByTestId('mobile-nav-avatar-photo') as HTMLImageElement;
    // Through Next's optimizer, not at the raw URL (#11). The avatar is one
    // fixed imgproxy render at `dpr:2/q:95`; `/_next/image` is what turns it
    // into an AVIF sized for this 30px circle. Both halves are pinned: the
    // original URL is still the thing being asked for, and the width and
    // quality are the deliberate ones.
    expect(img.src).toContain('/_next/image');
    expect(img.src).toContain(encodeURIComponent('https://cdn.example/avatars/cust-1.webp'));
    expect(img.src).toContain('q=90');
    expect(screen.queryByTestId('avatar-generic')).toBeNull();
  });

  it('renders the generic icon when signed in but no avatar has been uploaded', () => {
    mockUseUser.mockReturnValue({ data: { userId: 'cust-1', email: 'a@b.com' }, isLoading: false });
    mockUseCustomerProfile.mockReturnValue({ data: { avatarUrl: null } });

    renderNav();
    makeVisible();

    expect(screen.getByTestId('avatar-generic')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-nav-avatar-photo')).toBeNull();
  });

  it('renders the generic icon — never a previous account\'s photo — when signed out', () => {
    // useUser() is what /auth/me having answered 401 looks like: data masked
    // back to undefined. useCustomerProfile is still stubbed with a photo to
    // prove the component does not fall back to it once signed out — the
    // exact cross-account leak shape reported repeatedly in this codebase.
    mockUseUser.mockReturnValue({ data: undefined, isLoading: false });
    mockUseCustomerProfile.mockReturnValue({
      data: { avatarUrl: 'https://cdn.example/avatars/previous-user.webp' },
    });

    renderNav();
    makeVisible();

    expect(screen.getByTestId('avatar-generic')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-nav-avatar-photo')).toBeNull();
    // useCustomerProfile must have been called with enabled: false — a guest
    // should never even fire the authenticated request.
    expect(mockUseCustomerProfile).toHaveBeenCalledWith({ enabled: false });
  });

  it('falls back to the generic icon if the photo URL fails to load', () => {
    mockUseUser.mockReturnValue({ data: { userId: 'cust-1', email: 'a@b.com' }, isLoading: false });
    mockUseCustomerProfile.mockReturnValue({
      data: { avatarUrl: 'https://cdn.example/broken.webp' },
    });

    renderNav();
    makeVisible();

    // Two failures, not one, and the order matters (#11). The first is the
    // OPTIMIZER failing — which is not the same thing as the photo being
    // unavailable, since `/_next/image` also 400s on a host that has drifted
    // out of `remotePatterns`. That must not cost the customer their photo,
    // so `RemoteImage` retries the original URL on a plain tag first...
    fireEvent.error(screen.getByTestId('mobile-nav-avatar-photo'));

    const direct = screen.getByTestId('mobile-nav-avatar-photo') as HTMLImageElement;
    expect(direct.src).toBe('https://cdn.example/broken.webp');
    expect(screen.queryByTestId('avatar-generic')).toBeNull();

    // ...and only when THAT fails too is the photo genuinely unavailable and
    // the silhouette correct.
    fireEvent.error(direct);

    expect(screen.getByTestId('avatar-generic')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-nav-avatar-photo')).toBeNull();
  });

  it('never renders a first-initial letter for the account tab, with or without an avatar', () => {
    mockUseUser.mockReturnValue({ data: { userId: 'cust-1', email: 'annie@example.com', name: 'Annie' }, isLoading: false });
    mockUseCustomerProfile.mockReturnValue({ data: { avatarUrl: null } });

    renderNav();
    makeVisible();

    const link = accountLink();
    // The account tab's only text content is its own "Account" label — no
    // lone initial letter rendered anywhere inside it.
    const lonelyLetters = within(link)
      .queryAllByText(/^[A-Za-z]$/)
      .filter((el) => el.textContent?.trim().length === 1);
    expect(lonelyLetters).toHaveLength(0);
  });
});

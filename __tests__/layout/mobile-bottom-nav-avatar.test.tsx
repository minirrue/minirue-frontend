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

function accountLink(): HTMLElement {
  return screen.getByRole('link', { name: /^Account$/ });
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
    expect(img.src).toBe('https://cdn.example/avatars/cust-1.webp');
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

    const img = screen.getByTestId('mobile-nav-avatar-photo');
    fireEvent.error(img);

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

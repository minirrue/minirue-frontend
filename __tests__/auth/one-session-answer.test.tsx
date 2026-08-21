/**
 * Unify the sign-in/sign-out trace: ONE answer to "is this browser signed in".
 *
 * Owner (2026-07-31): "please unify the login and logout sequence, unify the
 * tracking, i feel code is not organised well, not traced" / "we must ensure
 * one cookie only across the tab" / "fully traced".
 *
 * Auth state lived in six stores that could disagree, and each consumer read a
 * different subset. `lib/hooks/use-session-state.ts` is now the single
 * implementation; the full trace of every store is
 * `docs/superpowers/runbooks/auth-state-map.md`.
 *
 * These tests pin the two rules that were being broken in OPPOSITE directions
 * by two different consumers, because a fix for one is a regression for the
 * other unless both are stated:
 *
 *   1. Header failed closed on ANY /auth/me error, including a transient one.
 *      `useUser()` is retry:false with a 15-minute staleTime, so one
 *      unreachable call told a signed-in customer they were signed out for a
 *      quarter of an hour. Telling a live customer to sign in is its own bug.
 *
 *   2. MobileBottomNav never failed closed at all: its account tab's href read
 *      a `mr-session` localStorage snapshot written at sign-in and revoked by
 *      nothing, re-read only when `pathname` happened to change. A signed-out
 *      shopper's Account tab still linked into the account area, where the gate
 *      bounced them to /login. Two lines above, the SAME component read
 *      `useUser()` for the avatar — so the icon and the link disagreed.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { setSession } from '@/lib/session';
import { FALLBACK_CHROME } from '@/lib/api/storefront';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));

const apiMe = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  apiMe: (...args: unknown[]) => apiMe(...args),
  apiLogin: jest.fn(),
  apiRegister: jest.fn(),
  apiLogout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/customers', () => ({
  apiGetMe: jest.fn().mockResolvedValue(null),
  apiUpdateMe: jest.fn(),
  apiUploadMyAvatar: jest.fn(),
  apiGetAddresses: jest.fn().mockResolvedValue([]),
  apiCreateAddress: jest.fn(),
  apiDeleteAddress: jest.fn(),
  apiSetDefaultAddress: jest.fn(),
}));

jest.mock('@/lib/api/storefront', () => {
  const actual = jest.requireActual('@/lib/api/storefront');
  return { ...actual, apiGetChrome: jest.fn().mockResolvedValue(actual.FALLBACK_CHROME) };
});

jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => ({ itemCount: 0, openDrawer: jest.fn() }),
}));

/** A settled refusal. apiFetch only throws this once a refresh has already failed. */
const REFUSED_401 = { status: 401, message: 'Session expired' };
/** "We could not check" — the API was unreachable. NOT a sign-out. */
const TRANSIENT_503 = { status: 503, message: 'Service unavailable' };

const SARAH = {
  userId: 'u1',
  email: 'sarah@example.com',
  name: 'Sarah Ahmed',
  role: 'CUSTOMER',
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

const renderHeader = () => renderWithClient(<Header navbar={FALLBACK_CHROME.navbar} />);

function renderBottomNav() {
  // The bar only renders below 1024px, and only once a scroll has moved it in.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  return renderWithClient(<MobileBottomNav />);
}

/**
 * Queried by label rather than by role: the bar sits at `visibility: hidden`
 * until a downward scroll slides it in, so a role query skips it. What is under
 * test is the href the tab CARRIES, which is decided at render and is wrong
 * long before the shopper can see it.
 */
const accountLink = () => screen.getByLabelText('Account');

beforeEach(() => {
  localStorage.clear();
  apiMe.mockReset();
  document.cookie = 'mr-auth=; Max-Age=0; path=/';
});

describe('a transient /auth/me failure is not a sign-out (Header)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  });

  it('keeps greeting a shopper whose session was proven, when /auth/me then fails transiently', async () => {
    setSession({ ...SARAH, createdAt: Date.now() });
    // Proven first — a real session, exactly as after a sign-in.
    apiMe.mockResolvedValueOnce(SARAH);

    const { client } = renderHeader();
    // The signed-in header shows the account AVATAR, not a greeting. The name
    // moved into the button's accessible label when "HI, SARAH" was replaced by
    // the avatar (2026-08-21) — the invariant under test is unchanged: a
    // shopper whose session was proven still has their account control.
    await screen.findByRole('button', { name: /Account menu for Sarah/i });

    // Now a BACKGROUND poll fails for a reason that is not a refusal. An
    // explicit refetch, because useUser()'s 15-minute staleTime means nothing
    // would refetch on its own — which is exactly why the bug lasted 15
    // minutes in production once it struck.
    apiMe.mockRejectedValue(TRANSIENT_503);
    await client.refetchQueries({ queryKey: ['auth', 'me'] });
    await waitFor(() => {
      expect(client.getQueryState(['auth', 'me'])?.status).toBe('error');
    });

    // Before the fix this read `isError`, which is true for a 503 as well as a
    // 401, so the greeting and the whole account menu vanished for a shopper
    // whose session was perfectly alive.
    expect(screen.getByRole('button', { name: /Account menu for Sarah/i })).toBeInTheDocument();
  });

  it('still drops the greeting on a settled 401 — failing closed is not weakened', async () => {
    setSession({ ...SARAH, createdAt: Date.now() });
    apiMe.mockRejectedValue(REFUSED_401);

    renderHeader();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Account menu for Sarah/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});

describe('the account tab opens the menu (MobileBottomNav)', () => {
  /**
   * The destination moved; the rule did not.
   *
   * Since 2026-08-21 this tab is a BUTTON that opens the menu sheet rather than
   * a link — the same avatar in the header does the same thing, and one control
   * meaning two things depending on which end of the screen it sat at was the
   * confusion the unification removed.
   *
   * The "where does a refused shopper end up" invariant these tests were
   * written for now lives one tap deeper, on the sheet's own account entry, and
   * is asserted in __tests__/storefront/mobile-nav-account-button.test.tsx —
   * which already owns a full sheet fixture. `signedIn` reaches the sheet from
   * Header's PROVEN identity, not the localStorage note, which is the half that
   * made the original stale-snapshot bug possible.
   */
  it('is a button that opens the menu, carrying no destination of its own', async () => {
    apiMe.mockResolvedValue(SARAH);

    renderBottomNav();

    // By label, not role: the bar sits at `visibility: hidden` until a scroll
    // slides it in, so a role query skips it — same reason the helper above
    // uses getByLabelText.
    await waitFor(() => {
      expect(screen.getByLabelText('Account and menu')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Account and menu').tagName).toBe('BUTTON');
    expect(screen.queryByLabelText('Account')).not.toBeInTheDocument();
  });
});

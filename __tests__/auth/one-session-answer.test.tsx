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
    await screen.findByText(/Hi, Sarah/);

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
    expect(screen.getByText(/Hi, Sarah/)).toBeInTheDocument();
  });

  it('still drops the greeting on a settled 401 — failing closed is not weakened', async () => {
    setSession({ ...SARAH, createdAt: Date.now() });
    apiMe.mockRejectedValue(REFUSED_401);

    renderHeader();

    await waitFor(() => {
      expect(screen.queryByText(/Hi, Sarah/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});

describe('the account tab links where the shopper can actually go (MobileBottomNav)', () => {
  it('sends a refused shopper to /login even though mr-session still names them', async () => {
    // The stale-snapshot bug, exactly: sign-out cleared the server session but
    // this render still has the localStorage note. The old code read the note
    // alone, so the tab linked to /account/profile and the gate bounced them.
    setSession({ ...SARAH, createdAt: Date.now() });
    apiMe.mockRejectedValue(REFUSED_401);

    renderBottomNav();

    await waitFor(() => {
      expect(accountLink()).toHaveAttribute('href', '/login');
    });
  });

  it('sends a signed-in shopper to their profile', async () => {
    apiMe.mockResolvedValue(SARAH);

    renderBottomNav();

    await waitFor(() => {
      expect(accountLink()).toHaveAttribute('href', '/account/profile');
    });
  });

  it('does not send a shopper to /login on a transient failure once the session was proven', async () => {
    apiMe.mockResolvedValueOnce(SARAH).mockRejectedValue(TRANSIENT_503);

    renderBottomNav();

    await waitFor(() => {
      expect(accountLink()).toHaveAttribute('href', '/account/profile');
    });
    // The link must not flip to /login just because a background poll failed.
    expect(accountLink()).toHaveAttribute('href', '/account/profile');
  });
});

/**
 * QC pass 3 (2026-07-31): the header is the first thing that tells a shopper
 * whether they are signed in, and it was reading the weakest of the three
 * signals — the `mr-session` localStorage note, a snapshot written at sign-in
 * that nothing revokes — exactly once, in a mount-only effect.
 *
 * So a sign-out that happened anywhere other than the header's OWN button left
 * "Hi, Sarah" and the whole account menu on screen: the account page's Sign
 * out (AccountLayoutClient), another tab, or a session revoked server-side.
 * The header is not remounted by a client-side navigation, so nothing ever
 * re-read the note.
 *
 * It now derives from `useUser()`. Once /auth/me has actually ANSWERED 401 the
 * note is stale by definition and the header fails closed.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
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

function renderHeader() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Header navbar={FALLBACK_CHROME.navbar} />
    </QueryClientProvider>,
  );
}

describe('the header stops greeting someone the server has refused', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMe.mockReset();
    // Desktop, so the account menu renders in the top bar rather than inside
    // the mobile sheet.
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  });

  it('greets the shopper while /auth/me still answers', async () => {
    setSession({
      userId: 'u1',
      email: 'sarah@example.com',
      name: 'Sarah Ahmed',
      role: 'CUSTOMER',
      createdAt: Date.now(),
    });
    apiMe.mockResolvedValue({
      userId: 'u1',
      email: 'sarah@example.com',
      name: 'Sarah Ahmed',
      role: 'CUSTOMER',
    });

    renderHeader();
    expect(await screen.findByText(/Hi, Sarah/)).toBeInTheDocument();
  });

  it('drops the greeting once /auth/me answers 401, even though mr-session still says otherwise', async () => {
    // The exact state a sign-out from the account page leaves behind if the
    // stale snapshot is trusted: the server has ended the session, the note is
    // still readable for this render.
    setSession({
      userId: 'u1',
      email: 'sarah@example.com',
      name: 'Sarah Ahmed',
      role: 'CUSTOMER',
      createdAt: Date.now(),
    });
    apiMe.mockRejectedValue({ status: 401, message: 'Session expired' });

    renderHeader();

    await waitFor(() => {
      expect(screen.queryByText(/Hi, Sarah/)).not.toBeInTheDocument();
    });
    // And it offers the way back in instead.
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});

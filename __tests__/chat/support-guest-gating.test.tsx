/**
 * Unit tests — components/chat/SupportWidget.tsx: who is allowed a composer.
 *
 * Owner report (2026-07-31, with a screenshot of
 * `/login?next=%2Faccount%2Fprofile&reason=session-expired`): the support panel
 * was fully open beside the SESSION-EXPIRED login page, showing the subject
 * picker and a live "Type a message…" box. Guest messaging was retired
 * (2026-07-29) and the server refuses a guest start, so that composer could
 * only ever produce a 401 after the shopper had typed.
 *
 * The rule these tests pin down:
 *   - a visitor we have NOT verified never sees a composer or a subject picker,
 *     including while /auth/me is still in flight (the window the screenshot
 *     caught — `authLoading` used to leave the composer open);
 *   - the browser-local `mr-auth` hint cookie, which is forgeable and documented
 *     as never trustworthy, can no longer open the composer on its own;
 *   - a shopper whose session is real is never wrongly told to sign in, not even
 *     when a background /auth/me fails transiently.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mutable auth mock ────────────────────────────────────────────────────
let mockAuthUser: { userId: string; email?: string } | null = null;
let mockAuthLoading = false;
let mockAuthIsError = false;
let mockAuthError: unknown = null;

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({
    data: mockAuthUser,
    isLoading: mockAuthLoading,
    isError: mockAuthIsError,
    error: mockAuthError,
  }),
}));

// The forgeable `mr-auth` hint cookie, driven independently of the real
// `/auth/me` answer — that divergence IS the bug under test.
let mockHintCookie = false;
jest.mock('@/lib/auth/tokens', () => ({
  isAuthenticated: () => mockHintCookie,
}));

jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerProfile: () => ({ data: null }),
}));

jest.mock('@/lib/support/support-context', () => ({
  useSupportContext: () => ({ subject: null, setSubject: () => undefined }),
}));

jest.mock('@/lib/api/settings', () => ({
  apiGetPublicSettings: () => Promise.resolve({ logoUrl: null, displayName: 'MiniRue' }),
}));

const mockApiStartSupport = jest.fn();
const mockApiSupportMine = jest.fn();
const mockApiSupportClaim = jest.fn();
const mockApiSupportMessages = jest.fn();
const mockApiSendSupport = jest.fn();
const mockApiSupportMeta = jest.fn();
const mockApiSupportHeartbeat = jest.fn();
const mockApiSupportUpload = jest.fn();

jest.mock('@/lib/api/support', () => ({
  apiStartSupport: (...args: unknown[]) => mockApiStartSupport(...args),
  apiSupportMine: (...args: unknown[]) => mockApiSupportMine(...args),
  apiSupportClaim: (...args: unknown[]) => mockApiSupportClaim(...args),
  apiSupportMessages: (...args: unknown[]) => mockApiSupportMessages(...args),
  apiSendSupport: (...args: unknown[]) => mockApiSendSupport(...args),
  apiSupportMeta: (...args: unknown[]) => mockApiSupportMeta(...args),
  apiSupportHeartbeat: (...args: unknown[]) => mockApiSupportHeartbeat(...args),
  apiSupportUpload: (...args: unknown[]) => mockApiSupportUpload(...args),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/login',
}));

import SupportWidget from '@/components/chat/SupportWidget';
import { IDENTITY_CLEARED_EVENT } from '@/lib/api/client';

/** The session-expired 401 apiFetch throws once a refresh has already failed. */
const REFUSED_401 = { status: 401, message: 'Session expired' };
/** A transient failure: the API was unreachable, NOT a server "no". */
const TRANSIENT_500 = { status: 503, message: 'Service unavailable' };

const composer = () => screen.queryByLabelText(/type your message/i);
const sendButton = () => screen.queryByRole('button', { name: /^send message$/i });
const subjectPicker = () => screen.queryByText(/what's this about\?/i);

async function openPanel() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /open live support chat/i }));
  return user;
}

describe('SupportWidget — a composer requires a verified session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockAuthUser = null;
    mockAuthLoading = false;
    mockAuthIsError = false;
    mockAuthError = null;
    mockHintCookie = false;
    mockApiSupportMeta.mockResolvedValue(null);
    mockApiSupportHeartbeat.mockResolvedValue(undefined);
    mockApiSupportClaim.mockResolvedValue(null);
    mockApiSupportMine.mockResolvedValue([]);
    mockApiSupportMessages.mockResolvedValue([]);
    mockApiStartSupport.mockResolvedValue({
      conversation: { id: 'conv-1', type: 'GENERAL' },
      message: {
        id: 'm-1',
        conversationId: 'conv-1',
        senderType: 'CUSTOMER',
        body: 'hello',
        createdAt: new Date().toISOString(),
      },
    });
  });

  it('signed out and settled: sign-in prompt, no composer, no subject picker', async () => {
    mockAuthIsError = true;
    mockAuthError = REFUSED_401;
    render(<SupportWidget />);
    await openPanel();

    expect(await screen.findByText(/sign in to message us/i)).toBeInTheDocument();
    expect(composer()).toBeNull();
    expect(sendButton()).toBeNull();
    expect(subjectPicker()).toBeNull();
  });

  it('signed out while /auth/me is still in flight: still no composer and no subject picker', async () => {
    // The screenshot's exact state on a cold load of the session-expired login
    // page. `authLoading` used to be excluded from the guest decision, so the
    // panel opened with a live composer for as long as /auth/me took to fail —
    // and forever if it never settled.
    mockAuthLoading = true;
    render(<SupportWidget />);
    await openPanel();

    expect(composer()).toBeNull();
    expect(sendButton()).toBeNull();
    expect(subjectPicker()).toBeNull();
  });

  it('a stale mr-auth hint cookie cannot open the composer on its own', async () => {
    // The forgeable hint says "signed in"; nothing has verified it. Previously
    // the hint held a veto over the guest decision, which is how a signed-out
    // visitor kept getting a composer.
    mockHintCookie = true;
    mockAuthLoading = true;
    render(<SupportWidget />);
    await openPanel();

    expect(composer()).toBeNull();
    expect(sendButton()).toBeNull();
    expect(subjectPicker()).toBeNull();
  });

  it('a stale mr-auth hint cookie loses to a refused /auth/me', async () => {
    mockHintCookie = true;
    mockAuthIsError = true;
    mockAuthError = REFUSED_401;
    render(<SupportWidget />);
    await openPanel();

    expect(await screen.findByText(/sign in to message us/i)).toBeInTheDocument();
    expect(composer()).toBeNull();
    expect(subjectPicker()).toBeNull();
  });

  /** A signed-in shopper with exactly one thread lands on it, which is the view
   *  that carries the composer (an account with none lands on NewChatComposer). */
  function withOneExistingThread() {
    mockApiSupportMine.mockResolvedValue([
      { id: 'c-1', type: 'GENERAL', status: 'OPEN', lastMessageAt: new Date().toISOString() },
    ]);
  }

  it('genuinely signed in: the composer is present', async () => {
    mockAuthUser = { userId: 'cust-1', email: 'shopper@example.com' };
    mockHintCookie = true;
    withOneExistingThread();
    render(<SupportWidget />);
    await openPanel();

    await waitFor(() => expect(composer()).not.toBeNull());
    expect(sendButton()).not.toBeNull();
    expect(screen.queryByText(/sign in to message us/i)).toBeNull();
  });

  it('a transient /auth/me failure for a real session does NOT block the composer', async () => {
    // The false negative the old hint-cookie veto existed to prevent: useUser()
    // is retry:false with a 15-minute staleTime, so one unreachable /auth/me
    // used to tell a signed-in customer to sign in.
    mockAuthUser = { userId: 'cust-1', email: 'shopper@example.com' };
    mockHintCookie = true;
    withOneExistingThread();
    const { rerender } = render(<SupportWidget />);
    await openPanel();
    await waitFor(() => expect(composer()).not.toBeNull());

    mockAuthUser = null;
    mockAuthIsError = true;
    mockAuthError = TRANSIENT_500;
    rerender(<SupportWidget />);

    expect(composer()).not.toBeNull();
    expect(screen.queryByText(/sign in to message us/i)).toBeNull();
  });

  it('a session that dies mid-visit closes the composer even while /auth/me refetches', async () => {
    // The live sequence behind the screenshot: apiFetch 401s, clears auth state
    // and dispatches IDENTITY_CLEARED_EVENT, useUser drops its cache and
    // refetches (so isLoading is true again) and the redirect to
    // /login?reason=session-expired lands. The composer must already be gone.
    mockAuthUser = { userId: 'cust-1', email: 'shopper@example.com' };
    mockHintCookie = true;
    withOneExistingThread();
    const { rerender } = render(<SupportWidget />);
    await openPanel();
    await waitFor(() => expect(composer()).not.toBeNull());

    window.dispatchEvent(new Event(IDENTITY_CLEARED_EVENT));
    mockAuthUser = null;
    mockAuthLoading = true;
    rerender(<SupportWidget />);

    await waitFor(() => expect(composer()).toBeNull());
    expect(sendButton()).toBeNull();
    expect(subjectPicker()).toBeNull();
  });

  it('a blocked visitor cannot start a conversation even if a send is forced', async () => {
    // The composer is replaced, not merely hidden — nothing reaches the API.
    mockAuthIsError = true;
    mockAuthError = REFUSED_401;
    render(<SupportWidget />);
    await openPanel();
    await screen.findByText(/sign in to message us/i);

    expect(mockApiStartSupport).not.toHaveBeenCalled();
    expect(mockApiSendSupport).not.toHaveBeenCalled();
  });
});

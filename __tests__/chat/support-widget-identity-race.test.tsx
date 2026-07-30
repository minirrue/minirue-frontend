/**
 * Unit tests — components/chat/SupportWidget.tsx.
 *
 * An adversarial review found two real defects in the identity/logout
 * handling shipped earlier (support-logout-reset.test.tsx covers the
 * synchronous reset itself):
 *
 * 1. CRITICAL — a narrower-window recurrence of the cross-account leak.
 *    `resumeConversation`'s `apiSupportMessages` fetch and the bootstrap's
 *    claim+`apiSupportMine` chain both fire promises that resolve LATER. If
 *    identity changes while one is in flight, its `.then` still called
 *    `setMessages`/`setConversations`, repainting the PREVIOUS account's
 *    data over the state the identity-reset effect had just cleared.
 * 2. IMPORTANT — the bootstrap effect keyed on `isLoggedIn` (a boolean),
 *    which stays `true` across an Account A -> Account B switch, so
 *    Account B's own thread never auto-resumed even though
 *    `accountBootstrappedRef` had been reset.
 *
 * Both are fixed with a monotonic `identityTokenRef`, bumped once per real
 * identity transition; every async chain that repaints state captures it at
 * request time and bails in its `.then` if it has since moved on. The
 * bootstrap effect's dependency array now also includes `authUser?.userId`.
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mutable auth mock so a re-render can flip identity ─────────────────────

let mockAuthUser: { userId: string; email?: string } | null = {
  userId: 'cust-a',
  email: 'a@example.com',
};
let mockAuthLoading = false;

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: mockAuthUser, isLoading: mockAuthLoading }),
}));

jest.mock('@/lib/auth/tokens', () => ({
  isAuthenticated: () => true,
}));

jest.mock('@/lib/support/support-context', () => ({
  useSupportContext: () => ({ subject: null, setSubject: () => undefined }),
}));

jest.mock('@/lib/support/session', () => ({
  getGuestSupport: () => null,
  setGuestSupport: () => undefined,
  clearGuestSupport: () => undefined,
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

// ── Component ────────────────────────────────────────────────────────────
import SupportWidget from '@/components/chat/SupportWidget';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('SupportWidget — identity race conditions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = { userId: 'cust-a', email: 'a@example.com' };
    mockAuthLoading = false;
    mockApiSupportMeta.mockResolvedValue(null);
    mockApiSupportHeartbeat.mockResolvedValue(undefined);
    mockApiSupportClaim.mockResolvedValue(null);
  });

  it('a resumeConversation response that resolves AFTER logout does not repaint the old messages', async () => {
    const user = userEvent.setup();
    const messagesDeferred = deferred<unknown[]>();

    mockApiSupportMine.mockResolvedValue([
      { id: 'convo-a', type: 'GENERAL', status: 'OPEN', lastMessageAt: new Date().toISOString() },
    ]);
    mockApiSupportMessages.mockImplementation((id: string) => {
      if (id === 'convo-a') return messagesDeferred.promise;
      return Promise.resolve([]);
    });

    render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: /open live support chat/i }));

    // Bootstrap has resumed 'convo-a' and is awaiting its message fetch —
    // the request is genuinely in flight, not yet resolved.
    await waitFor(() => expect(mockApiSupportMessages).toHaveBeenCalledWith('convo-a'));

    // Logout WHILE that request is still pending.
    await act(async () => {
      mockAuthUser = null;
    });

    // Now let the stale request resolve, addressed to an account that is no
    // longer signed in.
    await act(async () => {
      messagesDeferred.resolve([
        {
          id: 'm-old',
          conversationId: 'convo-a',
          senderType: 'AGENT',
          body: 'Old account message',
          createdAt: new Date().toISOString(),
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    // The stale response must never have repainted the thread.
    expect(screen.queryByText('Old account message')).not.toBeInTheDocument();
  });

  it('switching from account A to account B bootstraps B\'s own thread, not A\'s and not nothing', async () => {
    const user = userEvent.setup();

    mockApiSupportMine.mockImplementation(() =>
      Promise.resolve(
        mockAuthUser?.userId === 'cust-a'
          ? [{ id: 'convo-a', type: 'GENERAL', status: 'OPEN', lastMessageAt: new Date().toISOString() }]
          : [{ id: 'convo-b', type: 'GENERAL', status: 'OPEN', lastMessageAt: new Date().toISOString() }],
      ),
    );
    mockApiSupportMessages.mockImplementation((id: string) => {
      if (id === 'convo-a') {
        return Promise.resolve([
          { id: 'm-a', conversationId: 'convo-a', senderType: 'AGENT', body: 'Message for A', createdAt: new Date().toISOString() },
        ]);
      }
      if (id === 'convo-b') {
        return Promise.resolve([
          { id: 'm-b', conversationId: 'convo-b', senderType: 'AGENT', body: 'Message for B', createdAt: new Date().toISOString() },
        ]);
      }
      return Promise.resolve([]);
    });

    const { rerender } = render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: /open live support chat/i }));
    await screen.findByText('Message for A');

    // Account switch: A -> B. `isLoggedIn` stays `true` throughout — the
    // exact case the boolean-keyed dependency array used to miss.
    mockAuthUser = { userId: 'cust-b', email: 'b@example.com' };
    rerender(<SupportWidget />);

    await screen.findByText('Message for B');
    expect(screen.queryByText('Message for A')).not.toBeInTheDocument();
  });
});

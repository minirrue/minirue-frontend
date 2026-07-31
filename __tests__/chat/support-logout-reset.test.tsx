/**
 * Unit tests — components/chat/SupportWidget.tsx (Task 15b).
 *
 * SupportWidget is mounted once globally (app/layout.tsx) and a logout never
 * unmounts it. Before this fix, its identity-bound state (conversationId,
 * messages, once-only bootstrap refs) survived a logout untouched, so a
 * signed-out visitor's message could land on the previous account's thread —
 * a real cross-account leak, reproduced by the owner.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mutable auth mock so a re-render can flip logged-in -> logged-out ──────

// Matches the real UserProfile shape (lib/auth/types.ts) — the component
// reads `authUser?.userId`, not `.id`.
let mockAuthUser: { userId: string; email?: string } | null = {
  userId: 'cust-1',
  email: 'shopper@example.com',
};
let mockAuthLoading = false;

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: mockAuthUser, isLoading: mockAuthLoading }),
}));

// The widget reads the shopper's own uploaded photo to stamp on its
// optimistic bubble (so their avatar never blinks to the generic icon
// mid-send). Mocked here for the same reason `use-auth` is: this suite
// renders the widget without a QueryClientProvider.
jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerProfile: () => ({ data: null }),
}));

// `isAuthenticated()` reads a browser-local hint that is documented (in
// SupportWidget itself) as able to lag the real `useUser()` signal — that lag
// is exactly the race that let a stale composer post into the old account's
// thread, so it is pinned to `true` here regardless of `mockAuthUser` rather
// than flipping in lockstep with it.
jest.mock('@/lib/auth/tokens', () => ({
  isAuthenticated: () => true,
}));

jest.mock('@/lib/support/support-context', () => ({
  useSupportContext: () => ({ subject: null, setSubject: () => undefined }),
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

// lib/support/session is left UNMOCKED on purpose: the second test asserts
// the real localStorage key is actually cleared, not just a mocked call.

// ── Component ────────────────────────────────────────────────────────────
import SupportWidget from '@/components/chat/SupportWidget';

describe('SupportWidget — logout clears the widget completely (Task 15b)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockAuthUser = { userId: 'cust-1', email: 'shopper@example.com' };
    mockAuthLoading = false;
    mockApiSupportMeta.mockResolvedValue(null);
    mockApiSupportHeartbeat.mockResolvedValue(undefined);
    mockApiSupportClaim.mockResolvedValue(null);
    mockApiSupportMine.mockResolvedValue([
      {
        id: 'old-account-convo',
        type: 'GENERAL',
        status: 'OPEN',
        lastMessageAt: new Date().toISOString(),
      },
    ]);
    mockApiSupportMessages.mockImplementation((id: string) => {
      if (id === 'old-account-convo') {
        return Promise.resolve([
          {
            id: 'm-old',
            conversationId: 'old-account-convo',
            senderType: 'AGENT',
            body: 'Old account message',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });
    mockApiStartSupport.mockResolvedValue({
      conversation: { id: 'conv-new-visitor', type: 'GENERAL' },
      message: {
        id: 'msg-new',
        conversationId: 'conv-new-visitor',
        senderType: 'CUSTOMER',
        body: 'hello',
        createdAt: new Date().toISOString(),
      },
    });
  });

  it("drops the previous account's thread when the user logs out", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: /open live support chat/i }));
    await screen.findByText('Old account message');

    // Logout: useUser().data -> null, then force the re-render a real
    // React Query invalidation would trigger.
    mockAuthUser = null;
    rerender(<SupportWidget />);

    await waitFor(() =>
      expect(screen.queryByText('Old account message')).not.toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/type your message/i), 'hello');
    await user.click(screen.getByRole('button', { name: /^send message$/i }));

    // A new visitor starts a brand-new conversation — never the old account's.
    await waitFor(() => expect(mockApiStartSupport).toHaveBeenCalled());
    expect(mockApiSendSupport).not.toHaveBeenCalledWith(
      'old-account-convo',
      expect.anything(),
      expect.anything(),
    );
  });

  it('clears the stored guest token on logout', async () => {
    window.localStorage.setItem(
      'mr-support-guest',
      JSON.stringify({ conversationId: 'g1', guestToken: 't' }),
    );
    const { rerender } = render(<SupportWidget />);
    await screen.findByText('Old account message');

    mockAuthUser = null;
    rerender(<SupportWidget />);

    await waitFor(() =>
      expect(window.localStorage.getItem('mr-support-guest')).toBeNull(),
    );
  });
});

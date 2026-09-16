import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockApiSupportUnread = jest.fn();
const mockApiMarkSupportRead = jest.fn();
const mockApiSupportMine = jest.fn();
const mockApiSupportMessages = jest.fn();

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: { userId: 'cust-1', email: 'shopper@example.com' }, isLoading: false }),
}));
jest.mock('@/lib/hooks/use-session-state', () => ({
  useSessionState: () => ({ status: 'signed-in' }),
}));
jest.mock('@/lib/hooks/use-customer', () => ({ useCustomerProfile: () => ({ data: null }) }));
jest.mock('@/lib/support/support-context', () => ({
  useSupportContext: () => ({ subject: null, setSubject: () => undefined }),
}));
jest.mock('@/lib/api/settings', () => ({
  apiGetPublicSettings: () => Promise.resolve({ logoUrl: null, displayName: 'MiniRue' }),
}));
jest.mock('@/lib/api/support', () => ({
  apiStartSupport: jest.fn(),
  apiSupportMine: (...args: unknown[]) => mockApiSupportMine(...args),
  apiSupportClaim: jest.fn().mockResolvedValue(null),
  apiSupportMessages: (...args: unknown[]) => mockApiSupportMessages(...args),
  apiSendSupport: jest.fn(),
  apiSupportMeta: jest.fn().mockResolvedValue(null),
  apiSupportHeartbeat: jest.fn().mockResolvedValue(undefined),
  apiSupportUpload: jest.fn(),
  apiSupportUnread: (...args: unknown[]) => mockApiSupportUnread(...args),
  apiMarkSupportRead: (...args: unknown[]) => mockApiMarkSupportRead(...args),
}));

import SupportWidget from '@/components/chat/SupportWidget';

describe('SupportWidget customer unread replies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiSupportUnread.mockResolvedValue(0);
    mockApiMarkSupportRead.mockResolvedValue(undefined);
    mockApiSupportMine.mockResolvedValue([]);
    mockApiSupportMessages.mockResolvedValue([]);
  });

  it('restores the server count after a page remount', async () => {
    mockApiSupportUnread.mockResolvedValue(3);
    const first = render(<SupportWidget />);
    expect(
      await screen.findByRole('button', { name: /3 unread messages/i }),
    ).toBeInTheDocument();

    first.unmount();
    render(<SupportWidget />);
    expect(
      await screen.findByRole('button', { name: /3 unread messages/i }),
    ).toBeInTheDocument();
    expect(mockApiSupportUnread).toHaveBeenCalledTimes(2);
  });

  it('marks the visible conversation read and clears only after the server confirms', async () => {
    const user = userEvent.setup();
    mockApiSupportUnread.mockResolvedValueOnce(2).mockResolvedValue(0);
    mockApiSupportMine.mockResolvedValue([
      { id: 'conversation-1', type: 'GENERAL', status: 'OPEN', lastMessageAt: new Date().toISOString() },
    ]);
    mockApiSupportMessages.mockResolvedValue([
      {
        id: 'staff-1',
        conversationId: 'conversation-1',
        senderType: 'STAFF',
        body: 'We replied',
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<SupportWidget />);
    const launcher = await screen.findByRole('button', { name: /2 unread messages/i });
    await user.click(launcher);

    await waitFor(() => expect(mockApiMarkSupportRead).toHaveBeenCalledWith('conversation-1'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open live support chat' })).toBeInTheDocument(),
    );
  });
});

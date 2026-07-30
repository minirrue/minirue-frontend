/**
 * Unit tests — components/chat/SupportWidget.tsx (W1.6).
 *
 * Covers the one distinction the whole task hinges on: pressing "New
 * conversation" sends `forceNew: true` to the backend; every other path that
 * can start a conversation (the plain composer send, reached when the
 * widget's bootstrap has not yet resolved an existing thread) does not.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ───────────────────────────────────────────────────────────────────

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

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: { id: 'cust-1', email: 'shopper@example.com' }, isLoading: false }),
}));

jest.mock('@/lib/auth/tokens', () => ({
  isAuthenticated: () => true,
}));

jest.mock('@/lib/support/session', () => ({
  getGuestSupport: () => null,
  setGuestSupport: () => undefined,
  clearGuestSupport: () => undefined,
}));

jest.mock('@/lib/support/support-context', () => ({
  useSupportContext: () => ({ subject: null, setSubject: () => undefined }),
}));

// ── Component ────────────────────────────────────────────────────────────────
import SupportWidget from '@/components/chat/SupportWidget';

function pendingConversationSnapshot() {
  const call = mockApiStartSupport.mock.calls[mockApiStartSupport.mock.calls.length - 1];
  return call?.[0] as Record<string, unknown> | undefined;
}

describe('SupportWidget — forceNew (W1.6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiSupportMeta.mockResolvedValue(null);
    mockApiSupportMessages.mockResolvedValue([]);
    mockApiSupportHeartbeat.mockResolvedValue(undefined);
    mockApiSupportClaim.mockResolvedValue(null);
  });

  it('handleNewChat (the "New conversation" button) sends forceNew: true', async () => {
    const user = userEvent.setup();
    // Zero existing conversations: the bootstrap lands directly on the
    // "new conversation" composer, which is where the button's submit lives.
    mockApiSupportMine.mockResolvedValue([]);
    mockApiStartSupport.mockResolvedValue({
      conversation: { id: 'conv-new', type: 'GENERAL' },
      message: { id: 'msg-1', conversationId: 'conv-new', senderType: 'CUSTOMER', body: 'Hi', createdAt: new Date().toISOString() },
    });

    render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: /open live support chat/i }));

    // Skip the product search — "Just a general question" is the composer's
    // escape hatch straight to the message field.
    await waitFor(() =>
      expect(screen.getByText(/just a general question/i)).toBeInTheDocument(),
    );
    await user.click(screen.getByText(/just a general question/i));

    await user.type(screen.getByPlaceholderText(/how can we help/i), 'I need help with an order');
    await user.click(screen.getByRole('button', { name: /start conversation/i }));

    await waitFor(() => expect(mockApiStartSupport).toHaveBeenCalledTimes(1));
    expect(pendingConversationSnapshot()).toEqual(
      expect.objectContaining({ forceNew: true, type: 'GENERAL' }),
    );
  });

  it('the implicit path (plain composer send, button never pressed) omits forceNew', async () => {
    const user = userEvent.setup();
    // apiSupportMine never resolves, so the bootstrap effect never assigns a
    // view or a conversationId — the widget stays on its initial state
    // ('thread' view, no conversation yet), which is exactly the "widget
    // opened, message typed, button never pressed" implicit path the backend
    // dedup exists for.
    mockApiSupportMine.mockReturnValue(new Promise(() => {}));
    mockApiStartSupport.mockResolvedValue({
      conversation: { id: 'conv-implicit', type: 'GENERAL' },
      message: { id: 'msg-1', conversationId: 'conv-implicit', senderType: 'CUSTOMER', body: 'Hi', createdAt: new Date().toISOString() },
    });

    render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: /open live support chat/i }));

    await user.type(screen.getByLabelText(/type your message/i), 'Hello, is anyone there?');
    await user.click(screen.getByRole('button', { name: /^send message$/i }));

    await waitFor(() => expect(mockApiStartSupport).toHaveBeenCalledTimes(1));
    const sent = pendingConversationSnapshot();
    expect(sent).toBeDefined();
    expect(sent).not.toHaveProperty('forceNew');
  });

  it('shows an empty thread after starting a new conversation (W1.7)', async () => {
    const user = userEvent.setup();
    // One existing conversation: the bootstrap resumes it directly (view
    // stays 'thread'), which is exactly the state "New conversation" has to
    // clear rather than append to.
    mockApiSupportMine.mockResolvedValue([
      { id: 'old', type: 'GENERAL', status: 'OPEN', lastMessageAt: new Date().toISOString() },
    ]);
    mockApiSupportMessages.mockImplementation((id: string) => {
      if (id === 'old') {
        return Promise.resolve([
          {
            id: 'm-old',
            conversationId: 'old',
            senderType: 'AGENT',
            body: 'Old message',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });
    mockApiStartSupport.mockResolvedValue({
      conversation: { id: 'conv-new', type: 'GENERAL' },
      message: {
        id: 'msg-new',
        conversationId: 'conv-new',
        senderType: 'CUSTOMER',
        body: 'Brand new question',
        createdAt: new Date().toISOString(),
      },
    });

    render(<SupportWidget />);
    await user.click(screen.getByRole('button', { name: /open live support chat/i }));
    expect(await screen.findByText('Old message')).toBeInTheDocument();

    // Reach the "New conversation" button via the conversations list.
    await user.click(screen.getByRole('button', { name: /back to conversations/i }));
    await user.click(await screen.findByRole('button', { name: /^new conversation$/i }));
    await user.click(await screen.findByText(/just a general question/i));
    await user.type(screen.getByPlaceholderText(/how can we help/i), 'Brand new question');
    await user.click(screen.getByRole('button', { name: /start conversation/i }));

    expect(await screen.findByText('Brand new question')).toBeInTheDocument();
    expect(screen.queryByText('Old message')).not.toBeInTheDocument();
  });
});

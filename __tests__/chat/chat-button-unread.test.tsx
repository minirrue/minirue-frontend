import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatButton from '@/components/chat/ChatButton';

describe('ChatButton unread support badge', () => {
  it('renders no badge when every support reply is read', () => {
    render(<ChatButton onClick={() => undefined} unreadCount={0} />);
    expect(screen.queryByTestId('support-unread-badge')).toBeNull();
    expect(screen.getByRole('button')).toHaveAccessibleName('Open live support chat');
  });

  it('shows the exact count and exposes it in the launcher label', () => {
    render(<ChatButton onClick={() => undefined} unreadCount={3} />);
    expect(screen.getByTestId('support-unread-badge')).toHaveTextContent('3');
    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Open live support chat, 3 unread messages',
    );
  });

  it('caps the visible count at 9+ while retaining the real accessible count', () => {
    render(<ChatButton onClick={() => undefined} unreadCount={12} />);
    expect(screen.getByTestId('support-unread-badge')).toHaveTextContent('9+');
    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Open live support chat, 12 unread messages',
    );
  });
});

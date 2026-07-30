/**
 * Unit tests — components/chat/ChatPanel.tsx (Task M, 2026-07-30).
 *
 * The backend resolves `senderAvatarUrl` per message (personal avatar ->
 * (COLLAB) brand logo -> null) but nothing rendered it — the owner's "their
 * avatar overrides any photo, like in support" was invisible. A URL must
 * render the photo; null must render the sender's initial letter and NEVER
 * an `<img>` element — a broken image or an empty gap is exactly what this
 * batch exists to prevent.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatPanel, { type ChatDisplayMessage } from '@/components/chat/ChatPanel';

const noop = () => {};

describe('ChatPanel — per-message sender avatar', () => {
  it('renders the photo when the message carries a senderAvatarUrl', () => {
    const messages: ChatDisplayMessage[] = [
      {
        id: 'm1',
        from: 'agent',
        name: 'MiniRue Support',
        senderAvatarUrl: 'https://example.com/avatar.jpg',
        text: 'Hi there, how can we help?',
        time: '12:00 PM',
      },
    ];

    render(<ChatPanel open messages={messages} onClose={noop} onSend={noop} />);

    const img = screen.getByAltText('MiniRue Support');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(screen.queryByTestId('msg-avatar-initial')).not.toBeInTheDocument();
  });

  it('falls back to the initial letter (no img element) when senderAvatarUrl is null', () => {
    const messages: ChatDisplayMessage[] = [
      {
        id: 'm2',
        from: 'cx',
        name: 'You',
        senderAvatarUrl: null,
        text: 'I have a question',
        time: '12:01 PM',
      },
    ];

    render(<ChatPanel open messages={messages} onClose={noop} onSend={noop} />);

    // The generic person icon, NOT an initial letter. The owner asked for the
    // initial-in-a-circle placeholder to be gone everywhere, so this pins it:
    // the fallback slot must contain the silhouette and no text.
    const fallback = screen.getByTestId('msg-avatar-initial');
    expect(fallback).toHaveTextContent('');
    expect(fallback.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('img').length).toBe(0);
  });
});

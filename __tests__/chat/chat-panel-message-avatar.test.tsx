/**
 * Unit tests — components/chat/ChatPanel.tsx (Task M, 2026-07-30).
 *
 * The backend resolves `senderAvatarUrl` per message (personal avatar ->
 * (COLLAB) brand logo / shop logo -> null) but nothing rendered it — the
 * owner's "their avatar overrides any photo, like in support" was invisible.
 * A URL must render the photo; null must render the GENERIC PERSON ICON and
 * NEVER an `<img>` element and never an initial letter — a broken image, an
 * empty gap, or a letter-in-a-circle are all exactly what this batch exists
 * to prevent.
 *
 * Extended 2026-07-31 (Task #33): the panel HEADER's avatar is the shop's own
 * uploaded logo, with the same generic-icon fallback.
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

  it('falls back to the generic person icon (no img element, no letter) when senderAvatarUrl is null', () => {
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

  // Task #33 — "when our admin uploaded his avatar which is the shop logo,
  // update it to be the avatar of our storefront chat support". The header
  // used to be a hard-coded "MR" monogram, so the uploaded logo had nowhere
  // to land.
  it('renders the shop logo in the header when shopAvatarUrl is provided', () => {
    render(
      <ChatPanel
        open
        messages={[]}
        onClose={noop}
        onSend={noop}
        headerTitle="MiniRue Support"
        shopAvatarUrl="https://example.com/shop-logo.png"
      />,
    );

    const logo = screen.getByAltText('MiniRue Support');
    expect(logo.tagName).toBe('IMG');
    expect(logo).toHaveAttribute('src', 'https://example.com/shop-logo.png');
    expect(screen.queryByTestId('header-avatar-generic')).not.toBeInTheDocument();
    // Never the monogram it replaced.
    expect(screen.queryByText('MR')).not.toBeInTheDocument();
  });

  it('falls back to the generic person icon in the header when no shop logo is set', () => {
    render(<ChatPanel open messages={[]} onClose={noop} onSend={noop} />);

    const fallback = screen.getByTestId('header-avatar-generic');
    expect(fallback).toHaveTextContent('');
    expect(fallback.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('img').length).toBe(0);
  });
});

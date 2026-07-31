import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatButton from '@/components/chat/ChatButton';

/**
 * 2026-07-31 owner ask: "the minirue support avatar in floating chat menu
 * not isndie the chat have generic avatar although we have uplaoded our
 * brand logo it shoudl be visible like inside chat support window itself."
 *
 * Inside the panel, the header already showed the uploaded logo
 * (chat-panel-message-avatar.test.tsx). The floating LAUNCHER button never
 * received `shopAvatarUrl` at all (`SupportWidget` fetched it and only
 * passed it to `ChatPanel`), so it always rendered a hardcoded chat-bubble
 * glyph regardless of what was uploaded. These tests pin the launcher to the
 * same avatar slot the panel header uses (`MessageAvatar`, exported from
 * ChatPanel.tsx): a real logo renders as an `<img>`, and no logo falls back
 * to the shared `GenericAvatarIcon` — never an initial letter, never the old
 * chat-bubble glyph.
 */
describe('ChatButton — the floating launcher shows the shop logo', () => {
  it('renders the uploaded shop logo when shopAvatarUrl is provided', () => {
    render(
      <ChatButton
        onClick={() => {}}
        shopAvatarUrl="https://example.com/shop-logo.png"
        shopName="MiniRue"
      />,
    );

    const logo = screen.getByAltText('MiniRue');
    expect(logo.tagName).toBe('IMG');
    expect(logo).toHaveAttribute('src', 'https://example.com/shop-logo.png');
    expect(screen.queryByTestId('chat-launcher-avatar-generic')).not.toBeInTheDocument();
  });

  it('falls back to the generic person icon (no img, no initial letter) when no logo is uploaded', () => {
    render(<ChatButton onClick={() => {}} shopAvatarUrl={null} />);

    const fallback = screen.getByTestId('chat-launcher-avatar-generic');
    expect(fallback.querySelector('svg')).not.toBeNull();
    expect(fallback).toHaveTextContent('');
    expect(document.querySelectorAll('img').length).toBe(0);
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatButton from '@/components/chat/ChatButton';

/**
 * REVERSED 2026-08-03, at the owner's explicit request: "get back the old icon
 * chat on the ball not our avatar, the avatar is only inside here [the panel
 * header] only leave it here".
 *
 * The previous rule (2026-07-31) put the uploaded shop logo on the floating
 * launcher, to match the panel header. This file used to pin that. The owner has
 * since decided the launcher is a CONTROL that says "talk to us" — identity
 * belongs to the conversation, not the button that opens it — and the logo still
 * renders in the panel header, which chat-panel-message-avatar.test.tsx covers.
 *
 * Keeping the file (rather than deleting it) because the rule flipped and the
 * next person needs to see that it flipped deliberately, not by accident.
 *
 * There is a second, mechanical reason the launcher must not hold an image, and
 * it is the bug that prompted this: an <img> inside the button made the browser's
 * native HTML5 image drag win on desktop, so dragging the ball dragged a
 * translucent copy of the LOGO instead of moving the button
 * (chat-button-drag.test.tsx covers the gesture itself).
 */
describe('ChatButton — the launcher shows the chat glyph, never a picture', () => {
  it('renders an inline svg glyph and no image, even when a shop logo is supplied', () => {
    render(
      <ChatButton
        onClick={() => {}}
        shopAvatarUrl="https://example.com/shop-logo.png"
        shopName="MiniRue"
      />,
    );

    const button = screen.getByTestId('chat-button');
    expect(button.querySelector('svg')).not.toBeNull();

    // The whole point: a supplied logo must NOT reach the launcher.
    expect(document.querySelectorAll('img').length).toBe(0);
    expect(screen.queryByAltText('MiniRue')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('chat-launcher-avatar-generic'),
    ).not.toBeInTheDocument();
  });

  it('renders the same glyph when no logo is supplied — there is no avatar branch left', () => {
    render(<ChatButton onClick={() => {}} shopAvatarUrl={null} />);

    const button = screen.getByTestId('chat-button');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('img').length).toBe(0);
  });

  it('opts out of native dragging, so a drag moves the ball rather than an image', () => {
    render(<ChatButton onClick={() => {}} shopAvatarUrl={null} />);

    const button = screen.getByTestId('chat-button');
    expect(button).toHaveAttribute('draggable', 'false');

    // Nothing inside may be the drag source or the hit target for the gesture.
    const glyph = button.querySelector('svg');
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveStyle({ pointerEvents: 'none' });
  });
});

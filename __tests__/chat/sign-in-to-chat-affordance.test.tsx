import React from 'react';
import { render, screen } from '@testing-library/react';
import SignInToChat from '@/components/chat/SignInToChat';
import Button from '@/components/ui/Button';

/**
 * #9 — the chat's signed-out prompt had no button affordance.
 *
 * The root cause was not bespoke styling, which is what it looked like. Both
 * actions were `<Link>`s, and the primary one carried
 * `className="mr-btn mr-btn--primary"` — class names that are **not defined in
 * any stylesheet in this repo**. So it rendered as plain text with no fill,
 * border or elevation, exactly like the secondary one beside it, while reading
 * as correctly styled at the call site.
 *
 * Both go through the shared `Button` now, which meant teaching it to render a
 * link: a navigation has to middle-click and open in a new tab, and a
 * `<button>` nested in an `<a>` is invalid HTML, so neither `onClick` +
 * `router.push` nor wrapping was the answer.
 */

jest.mock('next/navigation', () => ({
  usePathname: () => '/shop/all',
}));

describe('Button as a link', () => {
  it('renders an anchor when given href, not a button', () => {
    render(<Button href="/login">Sign in</Button>);

    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('still renders a real button when there is no href', () => {
    render(<Button onClick={() => {}}>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('carries the variant fill, so it is visibly a button either way', () => {
    // The whole point of the issue: "buttons look like buttons at a glance,
    // without hover". An anchor with no background is what was shipped.
    render(<Button href="/login" variant="primary">Sign in</Button>);

    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link.style.background).not.toBe('');
    expect(link.style.textDecoration).toBe('none');
  });
});

describe('SignInToChat', () => {
  it('offers both actions as controls, not as text', () => {
    render(<SignInToChat />);

    for (const name of [/^sign in$/i, /create an account/i]) {
      const el = screen.getByRole('link', { name });
      // A fill or a border — the two treatments that say "tappable" before a
      // pointer is anywhere near. Bare text has neither.
      const styled =
        el.style.background !== '' || el.style.borderColor !== '';
      expect(styled).toBe(true);
    }
  });

  it('gives one primary and one secondary, not two of the same weight', () => {
    render(<SignInToChat />);

    const signIn = screen.getByRole('link', { name: /^sign in$/i });
    const signUp = screen.getByRole('link', { name: /create an account/i });

    // Primary is filled ink; outline is transparent with a border. Comparing
    // them is what pins the hierarchy — two identical pills would be as wrong
    // as two bare links.
    expect(signIn.style.background).not.toBe(signUp.style.background);
  });

  it('meets the 44px touch floor', () => {
    render(<SignInToChat />);

    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveStyle({
      minHeight: '44px',
    });
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveStyle({
      minHeight: '44px',
    });
  });

  it('returns the shopper to the page they were reading', () => {
    // The prompt invites them away from whatever they were looking at, so both
    // routes have to carry a way back — otherwise signing in costs them the page.
    render(<SignInToChat />);

    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('/shop/all')),
    );
    expect(
      screen.getByRole('link', { name: /create an account/i }),
    ).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('/shop/all')));
  });
});

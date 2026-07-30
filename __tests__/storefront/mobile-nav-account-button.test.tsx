import React from 'react';
import { render, screen } from '@testing-library/react';
import MobileNavSheet from '@/components/layout/MobileNavSheet';
import type { ResolvedChrome } from '@/lib/api/storefront';

/**
 * 2026-07-30 owner ask: the sheet used to show an "Account" icon tile at the
 * top AND an "Account"/"Login" pill at the bottom — the exact same action
 * twice. The bottom pill is the one the owner wants kept (bigger target,
 * already anchored at thumb height); the top tile is dropped whenever it
 * would just repeat it. Signed in, that surviving pill shows the shopper's
 * first name instead of a generic label, truncated so a long name can never
 * overflow the bar or push the socials off it.
 */

const EMPTY_NAVBAR: ResolvedChrome['navbar'] = { items: [], showSearch: true, showAccount: true };

// Mirrors the shipped default (`storefront-defaults.ts`): an Account shortcut
// tile up top AND an Account footer button — the literal duplicate.
const DUPLICATE_ACCOUNT_MENU: ResolvedChrome['mobileMenu'] = {
  shortcuts: [
    { id: 'shortcut-home', label: 'Home', icon: 'home', kind: 'home', href: '/' },
    { id: 'shortcut-search', label: 'Search', icon: 'search', kind: 'search', href: null },
    { id: 'shortcut-account', label: 'Account', icon: 'user', kind: 'account', href: null },
  ],
  footerButton: { id: 'footer-account', label: 'Account', icon: 'user', kind: 'account', href: null },
};

function renderSheet(props: Partial<React.ComponentProps<typeof MobileNavSheet>> = {}) {
  return render(
    <MobileNavSheet
      open
      onClose={jest.fn()}
      navbar={EMPTY_NAVBAR}
      mobileMenu={DUPLICATE_ACCOUNT_MENU}
      socials={[]}
      signedIn={false}
      onOpenSearch={jest.fn()}
      {...props}
    />,
  );
}

describe('MobileNavSheet — account button dedupe', () => {
  it('signed out: shows a sign-in affordance exactly once, not the tile and the pill both', () => {
    renderSheet({ signedIn: false });

    // The footer pill ("Login" when signed out — see resolveMobileMenuAction's
    // guestLabel for the footer) is the one kept.
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    // The top shortcut row's own "Account"/"Sign in" tile must be gone — it
    // would just be the same action a second time.
    expect(screen.queryByRole('link', { name: /^sign in$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^account$/i })).toBeNull();

    // The other two shortcut tiles (Home, Search) are untouched — this isn't
    // "hide the whole row", only the duplicated action. (`^home$`, not
    // `/home/i` — the sheet's own wordmark link is aria-labelled
    // "MiniRue — home" and would otherwise match too.)
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
  });

  it('a shortcut tile that is the ONLY account entry point (no footer button configured) is kept', () => {
    renderSheet({
      signedIn: false,
      mobileMenu: {
        shortcuts: [{ id: 'shortcut-account', label: 'Account', icon: 'user', kind: 'account', href: null }],
        footerButton: null,
      },
    });

    expect(screen.getByRole('link', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('signed in: the footer button shows the resolved first name, not the admin label', () => {
    renderSheet({ signedIn: true, accountDisplayName: 'Yusuf' });

    expect(screen.getByRole('link', { name: /yusuf/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^account$/i })).toBeNull();
  });

  it('signed in with nothing resolved: falls back to the admin label, not a blank button', () => {
    renderSheet({ signedIn: true, accountDisplayName: undefined });

    expect(screen.getByRole('link', { name: /^account$/i })).toBeInTheDocument();
  });

  it('a long first name truncates with an ellipsis instead of wrapping or overflowing', () => {
    renderSheet({
      signedIn: true,
      accountDisplayName: 'Maximilian-Alessandro-Constantinopoulos',
    });

    const link = screen.getByRole('link', { name: /maximilian/i });
    const label = link.querySelector('span');
    expect(label).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    // The button itself must be allowed to shrink below its text's natural
    // width — the flexbox default (content-sized, no shrink) is what let a
    // long name push past the bar in the first place.
    expect(link).toHaveStyle({ minWidth: '0' });
  });
});

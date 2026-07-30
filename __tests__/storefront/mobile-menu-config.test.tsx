import React from 'react';
import { render, screen } from '@testing-library/react';
import MobileNavSheet from '@/components/layout/MobileNavSheet';
import type { ResolvedChrome } from '@/lib/api/storefront';

/**
 * W4b.1 — the mobile menu's shortcut row and footer pill are fully
 * admin-configured (`mobileMenu`, resolved server-side) instead of the old
 * hardcoded Home/Search/Account tiles + hardcoded Account pill.
 *
 * 2026-07-30 owner ask: showing the account/sign-in action twice (once as an
 * icon tile up top, once as a pill at the bottom) was never right, and the
 * default config data still lists Account in both places. `MobileNavSheet`
 * itself now dedupes at render time — an Account shortcut tile is dropped
 * whenever the footer pill is ALSO Account, since the pill (bigger target,
 * thumb-anchored) is the one being kept. `footerButton: null` still removes
 * the pill outright, same as before.
 */

const DEFAULT_MOBILE_MENU: ResolvedChrome['mobileMenu'] = {
  shortcuts: [
    { id: 'shortcut-home', label: 'Home', icon: 'home', kind: 'home', href: '/' },
    { id: 'shortcut-search', label: 'Search', icon: 'search', kind: 'search', href: null },
    { id: 'shortcut-account', label: 'Account', icon: 'user', kind: 'account', href: null },
  ],
  footerButton: { id: 'footer-button', label: 'Account', icon: 'user', kind: 'account', href: null },
};

const EMPTY_NAVBAR: ResolvedChrome['navbar'] = { items: [], showSearch: true, showAccount: true };

function renderSheet(overrides?: {
  mobileMenu?: ResolvedChrome['mobileMenu'];
  navbar?: ResolvedChrome['navbar'];
  socials?: ResolvedChrome['footer']['socials'];
  signedIn?: boolean;
}) {
  return render(
    <MobileNavSheet
      open
      onClose={jest.fn()}
      navbar={overrides?.navbar ?? EMPTY_NAVBAR}
      mobileMenu={overrides?.mobileMenu ?? DEFAULT_MOBILE_MENU}
      socials={overrides?.socials ?? []}
      signedIn={overrides?.signedIn ?? false}
      onOpenSearch={jest.fn()}
    />,
  );
}

describe('MobileNavSheet — shortcut tiles', () => {
  it('renders Home / Search from the default config, and Account only once (the footer pill)', () => {
    renderSheet();
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    // The shortcut row's own Account tile is deduped away — the footer pill
    // below (labelled "Login" for a guest) is the surviving account entry
    // point, not a "Sign in" tile up top as well.
    expect(screen.getByRole('link', { name: /^login$/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /^sign in$/i })).toBeNull();
  });

  it('renders a configured Brands tile linking to /brands', () => {
    renderSheet({
      mobileMenu: {
        shortcuts: [
          { id: 's1', label: 'Brands', icon: 'grid', kind: 'brands', href: '/brands' },
        ],
        footerButton: null,
      },
    });
    expect(screen.getByRole('link', { name: 'Brands' })).toHaveAttribute('href', '/brands');
  });

  it('the default config no longer shows the account action twice — only the footer pill', () => {
    renderSheet();
    // Guest: "Login" is the one surviving account entry point (the footer
    // pill); the shortcut row's own "Sign in" tile is gone.
    expect(screen.getByRole('link', { name: /^login$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^sign in$/i })).toBeNull();
  });

  it('footerButton: null renders no bottom pill, and Account appears exactly once in the whole sheet', () => {
    renderSheet({
      mobileMenu: { ...DEFAULT_MOBILE_MENU, footerButton: null },
      signedIn: true,
    });
    const accountMentions = screen.getAllByText(/^account$/i);
    expect(accountMentions).toHaveLength(1);
    expect(
      document.querySelector('[data-trace-id="PG-STOREFRONT-NAV-001::EL-LINK-mobile-nav-footer-button"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-trace-id="PG-STOREFRONT-NAV-001::EL-BTN-mobile-nav-footer-button"]'),
    ).toBeNull();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import MobileNavSheet from '@/components/layout/MobileNavSheet';
import type { ResolvedChrome } from '@/lib/api/storefront';

/**
 * W4b.1 — the mobile menu's shortcut row and footer pill are fully
 * admin-configured (`mobileMenu`, resolved server-side) instead of the old
 * hardcoded Home/Search/Account tiles + hardcoded Account pill, which
 * rendered "Account" twice. The default config reproduces that old output
 * exactly (back-compat); an explicit `footerButton: null` is what actually
 * removes the duplicate.
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
  it('renders Home / Search / Account from the default config', () => {
    renderSheet();
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    // Signed out, so the account shortcut shows the guest label.
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
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

  it('the default config keeps Account showing twice (shortcut + footer pill) — unchanged behaviour', () => {
    renderSheet();
    // Guest: "Sign in" (shortcut) and "Login" (footer) — different guest
    // wording per position, same as the old hardcoded pair.
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
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

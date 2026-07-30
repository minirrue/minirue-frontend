import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileNavSheet from '@/components/layout/MobileNavSheet';
import type { ResolvedChrome, ResolvedNavItem } from '@/lib/api/storefront';

/**
 * W4b.3 (socials pinned/coloured/animated) and the `prefers-reduced-motion`
 * requirement from W4b.2's drill transition.
 */

const EMPTY_MOBILE_MENU: ResolvedChrome['mobileMenu'] = { shortcuts: [], footerButton: null };

const SOCIALS: ResolvedChrome['footer']['socials'] = [
  { id: 'soc-ig', network: 'instagram', url: 'https://instagram.com/minirue' },
  { id: 'soc-wa', network: 'whatsapp', url: 'https://wa.me/1234567890' },
];

function renderSheet(navbar: ResolvedChrome['navbar'] = { items: [], showSearch: true, showAccount: true }) {
  return render(
    <MobileNavSheet
      open
      onClose={jest.fn()}
      navbar={navbar}
      mobileMenu={EMPTY_MOBILE_MENU}
      socials={SOCIALS}
      signedIn={false}
      onOpenSearch={jest.fn()}
    />,
  );
}

describe('MobileNavSheet — socials', () => {
  it('renders every configured social pinned in the footer region', () => {
    renderSheet();
    const region = document.querySelector(
      '[data-trace-id="PG-STOREFRONT-NAV-001::EL-REGION-mobile-nav-socials"]',
    );
    expect(region).not.toBeNull();
    expect(region?.querySelectorAll('a')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/minirue',
    );
  });

  it('renders socials in the brand-colour variant, not the plain currentColor default', () => {
    renderSheet();
    const igSvg = screen.getByRole('link', { name: 'instagram' }).querySelector('svg');
    // variant="brand" sets `color` on the <svg> itself so currentColor paths
    // resolve to the network's colour instead of inheriting an ambient one.
    expect(igSvg).toHaveStyle({ color: 'rgb(225, 48, 108)' });
  });

  it('scales down on pointer press (the tap animation)', async () => {
    renderSheet();
    const link = screen.getByRole('link', { name: 'instagram' });
    expect(link.style.transform).toBe('scale(1)');

    // fireEvent avoids userEvent's synthetic pointer-capture requirements,
    // which jsdom does not implement. The scale is driven by a
    // requestAnimationFrame spring (useSpringValue), so the new value shows
    // up a frame or two later — waitFor polls for it.
    const { fireEvent, waitFor } = await import('@testing-library/react');
    fireEvent.pointerDown(link);
    await waitFor(() => expect(link.style.transform).not.toBe('scale(1)'));
  });
});

describe('MobileNavSheet — reduced motion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function mockReducedMotion(matches: boolean) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  const drillable: ResolvedNavItem = {
    id: 'nav-perfume',
    label: 'Perfume',
    href: '/categories/perfume',
    children: [{ id: 'cat-unisex', label: 'Unisex', href: '/categories/unisex' }],
  };

  it('applies the drill curve when the shopper has no motion preference', async () => {
    mockReducedMotion(false);
    renderSheet({ items: [drillable], showSearch: true, showAccount: true });

    await userEvent.click(screen.getByRole('button', { name: /^perfume$/i }));

    const activePanel = document.querySelector('[aria-hidden="false"]');
    expect(activePanel).toHaveStyle({ transition: 'transform 500ms cubic-bezier(.3,1,.3,1)' });
  });

  it('disables the drill transition entirely when prefers-reduced-motion is set', async () => {
    mockReducedMotion(true);
    renderSheet({ items: [drillable], showSearch: true, showAccount: true });

    await userEvent.click(screen.getByRole('button', { name: /^perfume$/i }));

    const activePanel = document.querySelector('[aria-hidden="false"]');
    expect(activePanel).toHaveStyle({ transition: 'none' });
  });
});

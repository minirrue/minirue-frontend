import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileNavSheet from '@/components/layout/MobileNavSheet';
import type { ResolvedChrome, ResolvedNavItem } from '@/lib/api/storefront';

/**
 * W4b.2 — a category drills in when it has real subcategories
 * (`item.children`, resolved from the catalog tree) OR pinned products
 * (`item.featured`), not just pinned products as before. Drilling is a
 * stack so it can go arbitrary depth, with the back button / Escape
 * unwinding one level at a time.
 */

const EMPTY_MOBILE_MENU: ResolvedChrome['mobileMenu'] = { shortcuts: [], footerButton: null };

function renderSheet(navbar: ResolvedChrome['navbar'], onClose = jest.fn()) {
  return {
    onClose,
    ...render(
      <MobileNavSheet
        open
        onClose={onClose}
        navbar={navbar}
        mobileMenu={EMPTY_MOBILE_MENU}
        socials={[]}
        signedIn={false}
        onOpenSearch={jest.fn()}
      />,
    ),
  };
}

describe('MobileNavSheet — category drill-down', () => {
  it('a category with children (no pinned products) drills in instead of navigating', async () => {
    const withChildren: ResolvedNavItem = {
      id: 'nav-perfume',
      label: 'Perfume',
      href: '/categories/perfume',
      children: [
        { id: 'cat-unisex', label: 'Unisex', href: '/categories/unisex' },
        { id: 'cat-women', label: 'Women', href: '/categories/women' },
      ],
    };
    renderSheet({ items: [withChildren], showSearch: true, showAccount: true });

    // A drillable row is a <button>, not a <link> to /categories/perfume.
    expect(screen.queryByRole('link', { name: /perfume/i })).toBeNull();
    const trigger = screen.getByRole('button', { name: /perfume/i });

    await userEvent.click(trigger);

    // The subcategories themselves are leaves (no children/featured of their
    // own), so they render as plain links, not further drill buttons.
    expect(screen.getByRole('link', { name: /^unisex$/i })).toHaveAttribute('href', '/categories/unisex');
    expect(screen.getByRole('link', { name: /^women$/i })).toHaveAttribute('href', '/categories/women');
  });

  it('a category with pinned products but no children still drills in', async () => {
    const withFeatured: ResolvedNavItem = {
      id: 'nav-rose',
      label: 'Rose',
      href: '/categories/rose',
      featured: [
        { id: 'p1', slug: 'rose-absolue', name: 'Rose Absolue' } as unknown as Record<string, unknown>,
      ],
    };
    renderSheet({ items: [withFeatured], showSearch: true, showAccount: true });

    expect(screen.getByRole('button', { name: /rose/i })).toBeInTheDocument();
  });

  it('a category with neither children nor pinned products is a plain link and navigates', () => {
    const plain: ResolvedNavItem = { id: 'nav-plain', label: 'Journal', href: '/journal' };
    renderSheet({ items: [plain], showSearch: true, showAccount: true });

    expect(screen.queryByRole('button', { name: /journal/i })).toBeNull();
    expect(screen.getByRole('link', { name: /journal/i })).toHaveAttribute('href', '/journal');
  });

  it('drilling two levels and backing out twice returns to the root panel', async () => {
    const grandchild: ResolvedNavItem = { id: 'cat-l3', label: 'Oud', href: '/categories/oud' };
    const child: ResolvedNavItem = {
      id: 'cat-l2',
      label: 'Unisex',
      href: '/categories/unisex',
      children: [grandchild],
    };
    const root: ResolvedNavItem = {
      id: 'cat-l1',
      label: 'Perfume',
      href: '/categories/perfume',
      children: [child],
    };
    renderSheet({ items: [root], showSearch: true, showAccount: true });

    // Drill one level: Perfume -> its content (a Unisex row, itself drillable
    // since it has a child).
    await userEvent.click(screen.getByRole('button', { name: /^perfume$/i }));
    expect(screen.getByRole('button', { name: /^unisex$/i })).toBeInTheDocument();

    // Drill a second level: Unisex -> its content (Oud, a leaf — a link).
    // The header back button now reads "Unisex" — the panel's own name,
    // unique in the tree since the shallower "Unisex" row is now hidden
    // behind an aria-hidden inactive panel.
    await userEvent.click(screen.getByRole('button', { name: /^unisex$/i }));
    expect(screen.getByRole('link', { name: /^oud$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^unisex$/i })).toBeInTheDocument();

    // Back once: header reads "Perfume" again (one level up, not root).
    await userEvent.click(screen.getByRole('button', { name: /^unisex$/i }));
    expect(screen.getByRole('button', { name: /^perfume$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^oud$/i })).toBeNull();

    // Back again: fully back to the root panel — "Perfume" is now the root
    // list's own drill row again, and the header shows the wordmark link,
    // not a back button with text.
    await userEvent.click(screen.getByRole('button', { name: /^perfume$/i }));
    expect(screen.getByRole('link', { name: /MiniRue — home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^perfume$/i })).toBeInTheDocument();
  });

  it('Escape backs out one level, not all the way to closed, when drilled', async () => {
    const child: ResolvedNavItem = { id: 'cat-child', label: 'Unisex', href: '/categories/unisex' };
    const root: ResolvedNavItem = {
      id: 'cat-root',
      label: 'Perfume',
      href: '/categories/perfume',
      children: [child],
    };
    const onClose = jest.fn();
    renderSheet({ items: [root], showSearch: true, showAccount: true }, onClose);

    await userEvent.click(screen.getByRole('button', { name: /^perfume$/i }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    // First Escape backs out of the drill, not the whole sheet.
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    // Second Escape (now at root) closes the sheet.
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

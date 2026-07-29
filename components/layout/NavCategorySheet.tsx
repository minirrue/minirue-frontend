'use client';

/**
 * NavCategorySheet — the desktop dropdown that slides down from behind the
 * header when a shopper hovers a category menu item that has pinned products.
 *
 * It renders inside <header> (which is sticky, therefore a positioned ancestor)
 * as one shared panel rather than one panel per menu item: hovering from
 * "Perfumes" to "Bags" then swaps the contents of a panel that is already open,
 * which is what a real mega-menu does. A panel per item would slide out and
 * back in on every sideways move.
 *
 * The slide is clipped by an overflow:hidden wrapper so the sheet genuinely
 * comes from outside the viewport edge, not from a fade at rest position.
 */

import React from 'react';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import type { ResolvedNavItem } from '@/lib/api/storefront';
import NavProductTile from './NavProductTile';

interface NavCategorySheetProps {
  /** The hovered item, or null when nothing is open. Kept mounted while closing
   *  so the outgoing contents do not blank out mid-slide. */
  item: ResolvedNavItem | null;
  open: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onNavigate: () => void;
}

export default function NavCategorySheet({
  item,
  open,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
}: NavCategorySheetProps) {
  // Hold the last real item so the panel keeps its contents through the
  // closing transition instead of collapsing to empty the instant it closes.
  // Adjusted during render rather than in an effect: an effect would paint the
  // empty panel for one frame first, which is the exact flicker this prevents.
  const [shown, setShown] = React.useState<ResolvedNavItem | null>(item);
  const [seenItem, setSeenItem] = React.useState<ResolvedNavItem | null>(item);
  if (item !== seenItem) {
    setSeenItem(item);
    if (item) setShown(item);
  }

  const products = (shown?.featured ?? []) as unknown as ApiProduct[];

  return (
    <div
      aria-hidden={!open}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        overflow: 'hidden',
        pointerEvents: open ? 'auto' : 'none',
        zIndex: 40,
      }}
    >
      <div
        data-trace-id="PG-STOREFRONT-NAV-001::EL-REGION-category-dropdown"
        style={{
          background: 'var(--mr-cream-100)',
          borderBottom: '1px solid var(--mr-hairline)',
          boxShadow: open ? 'var(--mr-shadow-lg)' : 'none',
          transform: open ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 480ms cubic-bezier(0.7,0,0.2,1), box-shadow 480ms ease',
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: '0 auto',
            padding: '32px 48px 40px',
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 240px) 1fr',
            gap: 48,
            alignItems: 'start',
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-4)',
              }}
            >
              {shown?.label}
            </p>
            <p
              style={{
                margin: '10px 0 20px',
                fontFamily: 'var(--mr-font-serif)',
                fontSize: 'var(--mr-text-2xl)',
                lineHeight: 1.1,
                color: 'var(--mr-fg)',
              }}
            >
              Picked for you
            </p>
            {shown && (
              <Link
                href={shown.href}
                onClick={onNavigate}
                data-trace-id="PG-STOREFRONT-NAV-001::EL-LINK-category-dropdown-view-all"
                style={{
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-fg)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--mr-border)',
                  paddingBottom: 4,
                }}
              >
                View all {shown.label} <span className="mr-link-arrow">→</span>
              </Link>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(products.length, 1)}, minmax(0, 220px))`,
              gap: 24,
            }}
          >
            {products.map((product, i) => (
              <NavProductTile
                key={product.id}
                product={product}
                index={i}
                revealed={open}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

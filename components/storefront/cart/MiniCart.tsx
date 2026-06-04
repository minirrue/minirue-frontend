'use client';

/**
 * MiniCart — header cart icon + item count badge.
 * Reads live count from CartContext and calls openDrawer on click.
 * Badge pulses when count increases (uses the mr-badge-pulse keyframe
 * already defined in mr-tokens.css via data-bump attribute).
 */

import React from 'react';
import { useCart } from './CartContext';

export default function MiniCart() {
  const { itemCount, openDrawer } = useCart();
  const prevCount = React.useRef(itemCount);
  const [bump, setBump] = React.useState(false);

  React.useEffect(() => {
    if (itemCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prevCount.current = itemCount;
      return () => clearTimeout(t);
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  return (
    <button
      aria-label={`Open shopping bag${itemCount > 0 ? `, ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}`}
      onClick={openDrawer}
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 'var(--mr-sp-2)',
        color: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--mr-radius-sm)',
        transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
      }}
    >
      {/* Bag icon — inline SVG, inherits currentColor */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>

      {/* Badge */}
      {itemCount > 0 && (
        <span
          data-bump={bump ? '1' : '0'}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            minWidth: 16,
            height: 16,
            borderRadius: 'var(--mr-radius-pill)',
            background: 'var(--mr-accent)',
            color: 'var(--mr-cream-100)',
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 10,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  );
}

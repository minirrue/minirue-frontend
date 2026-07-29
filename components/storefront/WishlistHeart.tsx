'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useWishlistToggle } from '@/lib/hooks/use-wishlist';

type Variant = 'pill' | 'round';

interface WishlistHeartProps {
  productId: string;
  /** Where to come back to after signing in. */
  returnTo?: string;
  /** `pill` sits beside the buy button; `round` floats on a product card. */
  variant?: Variant;
  size?: number;
  traceId?: string;
}

/**
 * The heart, wherever it appears.
 *
 * Self-contained on purpose: a grid of twenty cards would otherwise have to
 * thread saved-state and a handler down to every one of them. The hook shares
 * one fetch behind them all, so this costs nothing per card.
 */
export default function WishlistHeart({
  productId,
  returnTo,
  variant = 'round',
  size = 34,
  traceId = 'PG-STOREFRONT-CAT-005::EL-BTN-toggle-wishlist',
}: WishlistHeartProps) {
  const router = useRouter();
  const { saved, canSave, toggle, pending } = useWishlistToggle(productId);

  function onClick() {
    if (!canSave) {
      // A heart that fills and is forgotten the moment they leave is worse
      // than one that asks them to sign in.
      const next = returnTo ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    toggle();
  }

  const box = variant === 'pill' ? 52 : size;
  const glyph = variant === 'pill' ? 18 : Math.round(size * 0.47);

  return (
    <button
      type="button"
      data-trace-id={traceId}
      onClick={onClick}
      // Deliberately not disabled while saving: the fill is optimistic, so the
      // button stays live and a second tap simply toggles back. Disabling it
      // makes a slow connection feel like a broken button.
      aria-busy={pending || undefined}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save for later'}
      style={{
        width: box,
        height: box,
        borderRadius: 'var(--mr-radius-pill)',
        background: 'var(--mr-cream-200)',
        border:
          variant === 'pill' ? '1px solid var(--mr-border)' : '1px solid var(--mr-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        boxShadow: variant === 'round' ? 'var(--mr-shadow-sm)' : undefined,
        transform: saved ? 'scale(1.08)' : 'scale(1)',
        transition:
          'transform var(--mr-dur-fast) var(--mr-ease-spring), background var(--mr-dur-fast)',
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill={saved ? 'var(--mr-crimson-500)' : 'none'}
        stroke={saved ? 'var(--mr-crimson-500)' : 'var(--mr-ink-700)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition:
            'transform var(--mr-dur-medium) var(--mr-ease-spring), fill var(--mr-dur-medium), stroke var(--mr-dur-medium)',
          transform: saved ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}

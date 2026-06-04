'use client';

/**
 * CartDrawer — slide-in panel showing live cart contents.
 *
 * Triggered via CartContext.drawerOpen / openDrawer / closeDrawer.
 * CSS-only slide transition (no Framer Motion).
 * Accessibility: focus trap + Escape key to close.
 */

import React from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import CartItemRow from './CartItemRow';
import PriceDisplay from '@/components/storefront/PriceDisplay';
import Sparkle from '@/components/ui/Sparkle';

export default function CartDrawer() {
  const { items, subtotalAmount, currency, itemCount, loading, error, drawerOpen, closeDrawer, updateQty, removeItem, clearError } =
    useCart();

  const drawerRef = React.useRef<HTMLElement | null>(null);

  // Focus trap
  React.useEffect(() => {
    if (!drawerOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,11,11,0.44)',
          backdropFilter: drawerOpen ? 'blur(3px)' : 'blur(0)',
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? 'auto' : 'none',
          transition:
            'opacity 260ms var(--mr-ease-snappy), backdrop-filter 260ms var(--mr-ease-snappy)',
          zIndex: 80,
        }}
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          bottom: 16,
          width: 'min(480px, calc(100vw - 32px))',
          background: 'var(--mr-cream-100)',
          zIndex: 90,
          borderRadius: 'var(--mr-radius-lg)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
          transition: 'transform 400ms var(--mr-ease-out)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--mr-shadow-xl)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          style={{
            padding: '22px 26px',
            borderBottom: '1px solid var(--mr-hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg)',
            }}
          >
            Your bag
            {itemCount > 0 && (
              <span style={{ color: 'var(--mr-accent)', marginLeft: 6 }}>· {itemCount}</span>
            )}
          </span>
          <button
            aria-label="Close bag"
            onClick={closeDrawer}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--mr-fg-3)',
              fontSize: 22,
              lineHeight: 1,
              padding: 'var(--mr-sp-2)',
              display: 'flex',
              alignItems: 'center',
              transition: 'color var(--mr-dur-fast) var(--mr-ease-out)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--mr-fg)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--mr-fg-3)';
            }}
          >
            ×
          </button>
        </div>

        {/* ── Error banner ───────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            style={{
              padding: 'var(--mr-sp-3) var(--mr-sp-5)',
              background: 'var(--mr-st-danger-bg)',
              color: 'var(--mr-st-danger-fg)',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--mr-sp-3)',
              flexShrink: 0,
            }}
          >
            <span>{error}</span>
            <button
              aria-label="Dismiss error"
              onClick={clearError}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                fontSize: 16,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── Items ──────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 var(--mr-sp-6)',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
          }}
        >
          {items.length === 0 ? (
            /* Empty state */
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div
                style={{
                  animation: 'mr-breath 4s var(--mr-ease-ios) infinite',
                  display: 'inline-flex',
                }}
              >
                <Sparkle size={32} />
              </div>
              <p
                style={{
                  fontFamily: 'var(--mr-font-serif)',
                  fontStyle: 'italic',
                  fontSize: 'var(--mr-text-xl)',
                  color: 'var(--mr-fg-2)',
                  margin: '20px 0 8px',
                }}
              >
                Your cart is empty.
              </p>
              <p
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-sm)',
                  color: 'var(--mr-fg-3)',
                }}
              >
                Begin with a scent.
              </p>
              <button
                onClick={closeDrawer}
                style={{
                  marginTop: 'var(--mr-sp-5)',
                  background: 'none',
                  border: '1px solid var(--mr-border)',
                  borderRadius: 'var(--mr-radius-pill)',
                  padding: '10px 24px',
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-fg-2)',
                  cursor: 'pointer',
                  transition:
                    'border-color var(--mr-dur-fast) var(--mr-ease-out), color var(--mr-dur-fast) var(--mr-ease-out)',
                }}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQty={updateQty}
                onRemove={removeItem}
              />
            ))
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        {items.length > 0 && (
          <div
            style={{
              padding: 'var(--mr-sp-5) var(--mr-sp-6)',
              borderTop: '1px solid var(--mr-hairline)',
              flexShrink: 0,
            }}
          >
            {/* Subtotal row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 'var(--mr-sp-2)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-sm)',
                  color: 'var(--mr-fg-3)',
                }}
              >
                Subtotal
              </span>
              <PriceDisplay
                amount={subtotalAmount}
                currency={currency}
                style={{ fontSize: 'var(--mr-text-lg)' }}
              />
            </div>

            <p
              style={{
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-4)',
                marginBottom: 'var(--mr-sp-5)',
              }}
            >
              Shipping &amp; duties calculated at checkout.
            </p>

            {/* Checkout CTA */}
            {/* [TBD] — checkout page not yet built; href will update to /checkout */}
            <Link
              href="/cart"
              onClick={closeDrawer}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 24px',
                background: 'var(--mr-ink-900)',
                color: 'var(--mr-cream-100)',
                textAlign: 'center',
                textDecoration: 'none',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                borderRadius: 'var(--mr-radius-pill)',
                transition: 'background var(--mr-dur-fast) var(--mr-ease-out)',
                boxShadow: 'var(--mr-shadow-sm)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--mr-ink-800)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--mr-ink-900)';
              }}
            >
              View bag &amp; checkout
            </Link>

            {/* Continue shopping */}
            <button
              onClick={closeDrawer}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 'var(--mr-sp-3)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-3)',
                padding: '8px 0',
                textAlign: 'center',
                transition: 'color var(--mr-dur-fast) var(--mr-ease-out)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--mr-fg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--mr-fg-3)';
              }}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

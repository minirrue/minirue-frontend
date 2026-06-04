'use client';

/**
 * /cart — full cart page.
 *
 * Shows the same items as CartDrawer in a full-width table layout
 * with an order summary sidebar.
 *
 * [TBD] Shipping: shipping module not yet built — "Calculated at checkout" placeholder.
 * [TBD] Checkout: checkout page not yet built — CTA links to #checkout placeholder.
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/storefront/cart/CartContext';
import CartItemRow from '@/components/storefront/cart/CartItemRow';
import PriceDisplay from '@/components/storefront/PriceDisplay';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';

export default function CartPage() {
  const router = useRouter();
  const { items, subtotalAmount, currency, itemCount, loading, error, updateQty, removeItem, clearError, openDrawer } =
    useCart();

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <Header onOpenCart={openDrawer} cartCount={itemCount} />

        <main
          style={{
            maxWidth: 'var(--mr-content-max)',
            margin: '0 auto',
            padding: 'var(--mr-sp-7) var(--mr-gutter)',
          }}
        >
          {/* Page title */}
          <h1
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontSize: 'var(--mr-text-2xl)',
              fontWeight: 400,
              color: 'var(--mr-fg)',
              marginBottom: 'var(--mr-sp-7)',
              letterSpacing: '-0.01em',
            }}
          >
            Your Bag
          </h1>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              style={{
                padding: 'var(--mr-sp-3) var(--mr-sp-5)',
                background: 'var(--mr-st-danger-bg)',
                color: 'var(--mr-st-danger-fg)',
                borderRadius: 'var(--mr-radius-md)',
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--mr-sp-3)',
                marginBottom: 'var(--mr-sp-5)',
              }}
            >
              <span>{error}</span>
              <button
                aria-label="Dismiss error"
                onClick={clearError}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18 }}
              >
                ×
              </button>
            </div>
          )}

          {items.length === 0 ? (
            /* ── Empty state ──────────────────────────────────── */
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--mr-sp-9) 0',
                animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) both',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--mr-font-serif)',
                  fontStyle: 'italic',
                  fontSize: 'var(--mr-text-xl)',
                  color: 'var(--mr-fg-2)',
                  marginBottom: 'var(--mr-sp-4)',
                }}
              >
                Your cart is empty.
              </p>
              <Link
                href="/products"
                style={{
                  display: 'inline-block',
                  padding: '12px 32px',
                  background: 'var(--mr-ink-900)',
                  color: 'var(--mr-cream-100)',
                  textDecoration: 'none',
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--mr-radius-pill)',
                }}
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            /* ── Two-column layout ────────────────────────────── */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 340px',
                gap: 'var(--mr-sp-7)',
                alignItems: 'start',
              }}
            >
              {/* ── Left: items table ──────────────────────── */}
              <section
                aria-label="Cart items"
                style={{
                  opacity: loading ? 0.7 : 1,
                  transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
                }}
              >
                {/* Table header — desktop only */}
                <div
                  aria-hidden
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    paddingBottom: 'var(--mr-sp-3)',
                    borderBottom: '1px solid var(--mr-hairline)',
                    marginBottom: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg-4)',
                    }}
                  >
                    Product
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg-4)',
                    }}
                  >
                    Total
                  </span>
                </div>

                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQty={updateQty}
                    onRemove={removeItem}
                  />
                ))}

                {/* Continue shopping link */}
                <div style={{ marginTop: 'var(--mr-sp-5)' }}>
                  <Link
                    href="/products"
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg-3)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--mr-sp-2)',
                      transition: 'color var(--mr-dur-fast) var(--mr-ease-out)',
                    }}
                  >
                    ← Continue Shopping
                  </Link>
                </div>
              </section>

              {/* ── Right: order summary ───────────────────── */}
              <aside
                aria-label="Order summary"
                style={{
                  background: 'var(--mr-cream-100)',
                  borderRadius: 'var(--mr-radius-lg)',
                  padding: 'var(--mr-sp-6)',
                  boxShadow: 'var(--mr-shadow-sm)',
                  position: 'sticky',
                  top: 96,
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--mr-fg)',
                    marginBottom: 'var(--mr-sp-5)',
                  }}
                >
                  Order Summary
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
                  {/* Subtotal */}
                  <SummaryRow
                    label="Subtotal"
                    value={
                      <PriceDisplay amount={subtotalAmount} currency={currency} />
                    }
                  />

                  {/* Shipping — [TBD] */}
                  <SummaryRow
                    label="Shipping"
                    value={
                      <span
                        style={{
                          fontFamily: 'var(--mr-font-ui)',
                          fontSize: 'var(--mr-text-xs)',
                          color: 'var(--mr-fg-4)',
                          fontStyle: 'italic',
                        }}
                      >
                        Calculated at checkout {/* [TBD — shipping module not yet built] */}
                      </span>
                    }
                  />

                  <div
                    style={{
                      height: 1,
                      background: 'var(--mr-hairline)',
                      margin: 'var(--mr-sp-2) 0',
                    }}
                  />

                  {/* Total — [TBD] once shipping is added */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--mr-font-label)',
                        fontSize: 'var(--mr-text-sm)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--mr-fg)',
                        fontWeight: 600,
                      }}
                    >
                      Total
                    </span>
                    <PriceDisplay
                      amount={subtotalAmount /* [TBD] add shipping when available */}
                      currency={currency}
                      style={{ fontSize: 'var(--mr-text-lg)', color: 'var(--mr-fg)' }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => router.push('/checkout')}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 'var(--mr-sp-6)',
                    padding: '14px 24px',
                    background: 'var(--mr-ink-900)',
                    color: 'var(--mr-cream-100)',
                    textAlign: 'center',
                    border: 'none',
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--mr-radius-pill)',
                    boxShadow: 'var(--mr-shadow-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Proceed to Checkout
                </button>

                <p
                  style={{
                    fontFamily: 'var(--mr-font-ui)',
                    fontSize: 'var(--mr-text-xs)',
                    color: 'var(--mr-fg-4)',
                    textAlign: 'center',
                    marginTop: 'var(--mr-sp-3)',
                  }}
                >
                  Taxes &amp; duties calculated at checkout.
                </p>
              </aside>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </>
  );
}

// ── Internal components ───────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--mr-sp-3)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 'var(--mr-text-sm)',
          color: 'var(--mr-fg-3)',
        }}
      >
        {label}
      </span>
      {value}
    </div>
  );
}

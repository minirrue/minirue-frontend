'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/storefront/cart/CartContext';
import CartItemRow from '@/components/storefront/cart/CartItemRow';
import PriceDisplay from '@/components/storefront/PriceDisplay';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import { CheckoutAlert } from '@/components/checkout/checkout-ui';
import Button from '@/components/ui/Button';
import Toast from '@/components/ui/Toast';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { SHIPPING_AMOUNT_MINOR } from '@/lib/checkout/checkout-schemas';
import { getAccessToken } from '@/lib/auth/tokens';

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function CartPage() {
  const router = useRouter();
  const { mobile } = useBreakpoint();
  const { items, subtotalAmount, currency, itemCount, loading, error, updateQty, removeItem, clearError } =
    useCart();
  const [toast, setToast] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);

  const shippingDisplay = minorToAmount(SHIPPING_AMOUNT_MINOR);

  React.useEffect(() => {
    if (!getAccessToken()) {
      router.replace(`/login?returnUrl=${encodeURIComponent('/cart')}`);
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const handleRemove = async (itemId: string) => {
    const item = items.find((row) => row.id === itemId);
    await removeItem(itemId);
    const label = item?.name ?? 'Item';
    setToast(`${label} removed from your bag`);
  };

  if (!authChecked) {
    return null;
  }

  return (
    <CheckoutShell>
      <main
        data-screen-label="Storefront · Cart"
        style={{
          maxWidth: 'var(--mr-content-max)',
          margin: '0 auto',
          padding: mobile
            ? 'var(--mr-sp-6) var(--mr-gutter) var(--mr-sp-8)'
            : 'var(--mr-sp-7) var(--mr-gutter) var(--mr-sp-9)',
        }}
      >
        <CheckoutSteps current={1} />

        <p
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--mr-gold-500)',
            margin: '0 0 var(--mr-sp-3)',
          }}
        >
          Step 1 of 4
        </p>
        <h1
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontSize: mobile ? 'var(--mr-text-xl)' : 'var(--mr-text-2xl)',
            fontWeight: 400,
            color: 'var(--mr-fg)',
            marginBottom: 'var(--mr-sp-6)',
            letterSpacing: '-0.01em',
          }}
        >
          Your bag
          {itemCount > 0 && (
            <span
              style={{
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-sm)',
                color: 'var(--mr-fg-4)',
                marginLeft: 'var(--mr-sp-3)',
                fontWeight: 400,
              }}
            >
              ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </span>
          )}
        </h1>

        {error && (
          <CheckoutAlert variant="error" onDismiss={clearError}>
            {error}
          </CheckoutAlert>
        )}

        {items.length === 0 ? (
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
                marginBottom: 'var(--mr-sp-5)',
              }}
            >
              Your bag is empty — the maison awaits.
            </p>
            <Button variant="primary" sweep onClick={() => router.push('/products')}>
              Explore fragrances
            </Button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 1fr) minmax(260px, 320px)',
              gap: mobile ? 'var(--mr-sp-6)' : 'var(--mr-sp-7)',
              alignItems: 'start',
            }}
          >
            <section
              aria-label="Cart items"
              style={{
                opacity: loading ? 0.7 : 1,
                transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
              }}
            >
              {!mobile && (
                <div
                  aria-hidden
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    paddingBottom: 'var(--mr-sp-3)',
                    borderBottom: '1px solid var(--mr-hairline)',
                  }}
                >
                  <span style={tableHeaderStyle}>Product</span>
                  <span style={tableHeaderStyle}>Total</span>
                </div>
              )}

              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onUpdateQty={updateQty}
                  onRemove={handleRemove}
                />
              ))}

              <div style={{ marginTop: 'var(--mr-sp-5)' }}>
                <Link href="/products" style={continueLinkStyle}>
                  ← Continue shopping
                </Link>
              </div>
            </section>

            <aside
              aria-label="Order summary"
              style={{
                background: 'var(--mr-cream-100)',
                borderRadius: 'var(--mr-radius-lg)',
                padding: 'var(--mr-sp-6)',
                boxShadow: 'var(--mr-shadow-sm)',
                border: '1px solid var(--mr-hairline)',
                position: mobile ? 'static' : 'sticky',
                top: 96,
              }}
            >
              <h2 style={summaryTitleStyle}>Order summary</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
                <SummaryRow
                  label="Subtotal"
                  value={<PriceDisplay amount={subtotalAmount} currency={currency} />}
                />
                <SummaryRow
                  label="Shipping"
                  value={
                    <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-4)', fontStyle: 'italic' }}>
                      From {shippingDisplay} {currency}
                    </span>
                  }
                />
                <div style={{ height: 1, background: 'var(--mr-hairline)', margin: 'var(--mr-sp-2) 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ ...summaryTitleStyle, marginBottom: 0, fontSize: 'var(--mr-text-sm)' }}>
                    Estimated total
                  </span>
                  <PriceDisplay
                    amount={subtotalAmount}
                    currency={currency}
                    style={{ fontSize: 'var(--mr-text-lg)', color: 'var(--mr-fg)' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 'var(--mr-sp-6)' }}>
                <Button variant="primary" sweep onClick={() => router.push('/checkout')} style={{ width: '100%' }}>
                  Proceed to checkout
                </Button>
              </div>

              <p
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-xs)',
                  color: 'var(--mr-fg-4)',
                  textAlign: 'center',
                  marginTop: 'var(--mr-sp-3)',
                  lineHeight: 1.5,
                }}
              >
                Taxes &amp; duties calculated at checkout.
              </p>
            </aside>
          </div>
        )}
      </main>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </CheckoutShell>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-4)',
};

const summaryTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg)',
  marginBottom: 'var(--mr-sp-5)',
};

const continueLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--mr-sp-2)',
};

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
      <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
        {label}
      </span>
      {value}
    </div>
  );
}

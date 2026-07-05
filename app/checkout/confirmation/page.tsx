'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { apiCheckout } from '@/lib/checkout/checkout-api';
import {
  clearCheckoutSession,
  loadCheckoutSession,
  newIdempotencyKey,
} from '@/lib/checkout/checkout-session';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutPageFrame from '@/components/checkout/CheckoutPageFrame';
import { CheckoutAlert } from '@/components/checkout/checkout-ui';
import Button from '@/components/ui/Button';

export default function CheckoutConfirmationPage() {
  const router = useRouter();
  const { cartId, clearCart } = useCart();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('order');
    if (fromQuery) {
      setOrderNumber(fromQuery);
      setSessionChecked(true);
      return;
    }

    const session = loadCheckoutSession();
    if (!session?.shippingAddressId || session.paymentMethod !== 'COD') {
      router.replace('/checkout');
      return;
    }
    setSessionChecked(true);

    if (submitted.current) return;
    submitted.current = true;

    void apiCheckout(
      {
        cartId,
        shippingAddressId: session.shippingAddressId,
        paymentMethod: 'COD',
      },
      newIdempotencyKey(),
    )
      .then((order) => {
        setOrderNumber(order.orderNumber);
        clearCheckoutSession();
        void clearCart();
      })
      .catch((err: { message?: string }) => {
        setError(err.message ?? 'Checkout failed. Please try again.');
        submitted.current = false;
      });
  }, [cartId, clearCart, router]);

  if (!sessionChecked && !error) {
    return (
      <CheckoutShell>
        <CheckoutPageFrame step={4} title="Placing your order…" subtitle="One moment while we confirm your details.">
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--mr-sp-7) 0',
              fontFamily: 'var(--mr-font-serif)',
              fontStyle: 'italic',
              color: 'var(--mr-fg-3)',
            }}
          >
            Preparing confirmation…
          </div>
        </CheckoutPageFrame>
      </CheckoutShell>
    );
  }

  if (error) {
    return (
      <CheckoutShell>
        <CheckoutPageFrame step={4} title="Something went wrong" maxWidth={480}>
          <CheckoutAlert variant="error">{error}</CheckoutAlert>
          <Button variant="primary" sweep onClick={() => router.push('/checkout')} style={{ width: '100%' }}>
            Return to checkout
          </Button>
        </CheckoutPageFrame>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <CheckoutPageFrame
        step={4}
        eyebrow="Merci"
        title={orderNumber ? 'Order confirmed' : 'Placing your order…'}
        subtitle={
          orderNumber
            ? 'Thank you for shopping with MiniRue. A confirmation email will arrive shortly.'
            : undefined
        }
        maxWidth={520}
      >
        {orderNumber && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--mr-sp-6) var(--mr-sp-5)',
              borderRadius: 'var(--mr-radius-lg)',
              background: 'var(--mr-cream-100)',
              border: '1px solid var(--mr-hairline)',
              boxShadow: 'var(--mr-shadow-sm)',
              animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) both',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--mr-gold-700)',
                margin: '0 0 var(--mr-sp-3)',
              }}
            >
              Order number
            </p>
            <p
              className="mr-num"
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontSize: 'var(--mr-text-2xl)',
                color: 'var(--mr-fg)',
                margin: '0 0 var(--mr-sp-6)',
              }}
            >
              {orderNumber}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
              <Button variant="primary" sweep onClick={() => router.push('/account/orders')} style={{ width: '100%' }}>
                View order history
              </Button>
              <Link
                href="/products"
                style={{
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-fg-3)',
                  textDecoration: 'none',
                }}
              >
                Continue shopping <span className="mr-link-arrow">→</span>
              </Link>
            </div>
          </div>
        )}
      </CheckoutPageFrame>
    </CheckoutShell>
  );
}

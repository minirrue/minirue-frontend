'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { guestCheckoutFields, apiCheckout, type OrderSummary } from '@/lib/checkout/checkout-api';
import { loadAppliedCode, saveAppliedCode } from '@/lib/api/discounts';
import { formatApiError } from '@/lib/api/client';
import {
  clearCheckoutSession,
  loadCheckoutSession,
  newIdempotencyKey,
} from '@/lib/checkout/checkout-session';
import { orderTotalMinor } from '@/lib/checkout/checkout-schemas';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutPageFrame from '@/components/checkout/CheckoutPageFrame';
import { CheckoutAlert } from '@/components/checkout/checkout-ui';
import Button from '@/components/ui/Button';
import { track } from '@/lib/analytics';

export default function CheckoutConfirmationPage() {
  const router = useRouter();
  const { cartId, subtotalAmount, clearCart } = useCart();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  /**
   * The placed order, for the receipt below. Kept beside `orderNumber` rather
   * than replacing it because the Instapay flow arrives here with only an
   * `?order=` number in the URL and no order body to show — the number alone
   * still has to render a valid confirmation.
   */
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const submitted = useRef(false);
  const firedStepView = useRef(false);

  useEffect(() => {
    if (firedStepView.current) return;
    firedStepView.current = true;
    track('checkout_step_view', { step: 'review', cartId: cartId || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('order');
    if (fromQuery) {
      setOrderNumber(fromQuery);
      setSessionChecked(true);
      return;
    }

    // Placed already — nothing left to do, and CRITICALLY nothing left to
    // check. This guard used to sit BELOW the session check, which is how a
    // customer who had just successfully paid got sent back to the address
    // step: placing the order calls clearCheckoutSession() and clearCart(),
    // and clearing the cart flips `cartId` — a dependency of this effect — so
    // the effect re-ran, found the session it had itself just wiped, and read
    // that as an expired checkout. The order existed; the customer was bounced
    // off the confirmation of it.
    //
    // `submitted` covers the in-flight window and `orderNumber` the settled
    // one, because a failed attempt resets `submitted` so a retry can proceed.
    if (submitted.current || orderNumber) {
      setSessionChecked(true);
      return;
    }

    const session = loadCheckoutSession();
    // A guest carries `guest` where a signed-in shopper carries
    // `shippingAddressId`; either one means the Delivery step was completed.
    // Requiring the id alone sent every guest back to /checkout in a loop.
    if (
      !(session?.shippingAddressId || session?.guest) ||
      session.paymentMethod !== 'COD'
    ) {
      router.replace('/checkout');
      return;
    }
    setSessionChecked(true);
    // Same reason as the Instapay page: an order is placed against a cart, so
    // without one there is nothing to place and the API answers
    // "cartId: Invalid uuid" after the customer has already been told to wait.
    if (!cartId) {
      setError('Your bag is empty. Add something to it before placing an order.');
      return;
    }
    submitted.current = true;

    // Fired immediately before the order POST — never `purchase`, which is
    // emitted server-side only, inside the order transaction, so tracked
    // revenue reconciles exactly with the `orders` table.
    track('payment_initiated', {
      method: 'COD',
      cartId,
      totalMinor: orderTotalMinor(subtotalAmount),
    });

    void apiCheckout(
      {
        cartId,
        ...(session.guest
          ? guestCheckoutFields(session.guest)
          : { shippingAddressId: session.shippingAddressId }),
        paymentMethod: 'COD',
        // Whatever they applied in the bag or on the payment step. The server
        // re-resolves it and recomputes the saving; an undefined code simply
        // means no discount, never an error.
        ...(loadAppliedCode() ? { discountCode: loadAppliedCode()! } : {}),
      },
      newIdempotencyKey(),
    )
      .then((order) => {
        setOrderNumber(order.orderNumber);
        setOrder(order);
        clearCheckoutSession();
        // Forgotten once it has been spent. Leaving it behind would silently
        // re-apply a one-use code to the next order and fail at placement.
        saveAppliedCode(null);
        void clearCart();
      })
      .catch((err: unknown) => {
        // A 422 carries `message` as an array of {field, issue}; printing it
        // straight gave the customer "[object Object]".
        const message = formatApiError(err, 'Checkout failed. Please try again.');
        setError(message);
        track('payment_client_error', { method: 'COD', message });
        submitted.current = false;
      });
    // `orderNumber` is read by the guard above but deliberately NOT a
    // dependency: adding it would re-run this effect the moment the order
    // lands, which is the re-entrancy the guard exists to absorb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId, clearCart, router]);

  if (!sessionChecked && !error) {
    return (
      <CheckoutShell>
        <CheckoutPageFrame step={4} complete title="Placing your order…" subtitle="One moment while we confirm your details.">
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
        <CheckoutPageFrame step={4} complete title="Something went wrong" maxWidth={480}>
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
        complete
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
            {/*
              What was actually bought, on the page that says it was bought.
              The confirmation used to show a number and nothing else, so the
              one moment a shopper most wants to check their order against had
              the least to check. Rendered from the order the server returned,
              never from the cart — the cart is deliberately empty by now.

              Absent for the Instapay arrival, which carries only `?order=`.
              The number-only confirmation stays valid; this is additive.
            */}
            {/*
              Optional-chained, not asserted. The confirmation is the LAST
              thing that should fail: an order body missing `items` must cost
              the shopper a line-item list, never the page telling them their
              order went through.
            */}
            {order?.items?.length ? (
              <ul
                style={{
                  listStyle: 'none',
                  margin: '0 0 var(--mr-sp-5)',
                  padding: 'var(--mr-sp-5) 0 0',
                  borderTop: '1px solid var(--mr-hairline)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--mr-sp-4)',
                  textAlign: 'left',
                }}
              >
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: 'var(--mr-sp-4)',
                      alignItems: 'center',
                    }}
                  >
                    {item.productSnapshot?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.productSnapshot.imageUrl}
                        alt=""
                        width={56}
                        height={56}
                        style={{
                          width: 56,
                          height: 56,
                          objectFit: 'cover',
                          borderRadius: 'var(--mr-radius-sm)',
                          border: '1px solid var(--mr-hairline)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 'var(--mr-radius-sm)',
                          border: '1px solid var(--mr-hairline)',
                          background: 'var(--mr-cream-200)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: 'var(--mr-font-serif)',
                          fontSize: 'var(--mr-text-base)',
                          color: 'var(--mr-fg)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.productSnapshot?.name ?? 'Item'}
                      </p>
                      <p
                        style={{
                          margin: '2px 0 0',
                          fontFamily: 'var(--mr-font-label)',
                          fontSize: 'var(--mr-text-xs)',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: 'var(--mr-fg-3)',
                        }}
                      >
                        {item.productSnapshot?.brand
                          ? `${item.productSnapshot.brand} · `
                          : ''}
                        Qty {item.qty}
                      </p>
                    </div>
                    <p
                      className="mr-num"
                      style={{
                        margin: 0,
                        fontFamily: 'var(--mr-font-serif)',
                        fontSize: 'var(--mr-text-base)',
                        color: 'var(--mr-fg)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.lineTotalAmount} {order.totalCurrency}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            {order?.totalAmount && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 'var(--mr-sp-4)',
                  padding: 'var(--mr-sp-4) 0',
                  borderTop: '1px solid var(--mr-hairline)',
                  marginBottom: 'var(--mr-sp-5)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--mr-fg-3)',
                  }}
                >
                  Total paid
                </span>
                <span
                  className="mr-num"
                  style={{
                    fontFamily: 'var(--mr-font-serif)',
                    fontSize: 'var(--mr-text-xl)',
                    color: 'var(--mr-fg)',
                  }}
                >
                  {order.totalAmount} {order.totalCurrency}
                </span>
              </div>
            )}

            {/*
              What happens next, in the shopper's terms. "Cash on delivery"
              is the one thing a COD customer must know before the courier is
              at the door with their hand out, and it is the single most common
              support message this shop gets after an order.
            */}
            <p
              style={{
                margin: '0 0 var(--mr-sp-5)',
                fontFamily: 'var(--mr-font-sans)',
                fontSize: 'var(--mr-text-sm)',
                lineHeight: 1.6,
                color: 'var(--mr-fg-2)',
                textAlign: 'left',
              }}
            >
              We&apos;re preparing your order now. You&apos;ll get a message when it
              ships, and you can follow it any time from your orders.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
              <Button variant="primary" sweep onClick={() => router.push('/account/orders')} style={{ width: '100%' }}>
                Track your order
              </Button>
              <Link
                href="/shop/all"
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

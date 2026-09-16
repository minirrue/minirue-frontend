'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { toPricingLines } from '@/components/storefront/cart/bag-lines';
import { guestCheckoutFields, apiCheckout, type OrderSummary } from '@/lib/checkout/checkout-api';
import {
  codeRefusalAtPlacement,
  loadAppliedCode,
  saveAppliedCode,
} from '@/lib/api/discounts';
import { formatApiError } from '@/lib/api/client';
import {
  clearCheckoutSession,
  loadCheckoutSession,
  saveCheckoutSession,
  checkoutIdempotencyKey,
} from '@/lib/checkout/checkout-session';
import {
  REPLAY_DELAYS_MS,
  isCartAlreadyCheckedOut,
  loadPlacedOrder,
  placeWithReplay,
  savePlacedOrder,
} from '@/lib/checkout/placed-order';
import { realOrderTotalMinor } from '@/lib/checkout/real-order-total';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutPageFrame from '@/components/checkout/CheckoutPageFrame';
import { CheckoutAlert } from '@/components/checkout/checkout-ui';
import Button from '@/components/ui/Button';
import OrderLineList, { SetSavingsRow } from '@/components/orders/OrderLineList';
import OrderDeliveryInfo from '@/components/orders/OrderDeliveryInfo';
import { formatMoney } from '@/lib/format/money';
import { track } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/analytics/meta-pixel';
import { isAuthenticated } from '@/lib/auth/tokens';
import { orderBuyer, type OrderBuyer } from '@/lib/checkout/order-buyer';

const NOTE_STYLE: CSSProperties = {
  margin: '0 0 var(--mr-sp-5)',
  fontFamily: 'var(--mr-font-sans)',
  fontSize: 'var(--mr-text-sm)',
  lineHeight: 1.6,
  color: 'var(--mr-fg-2)',
  textAlign: 'left',
};

/** What a guest is told instead of "your orders" (#134). */
function GuestEmailNote({ maskedEmail }: { maskedEmail: string | null }) {
  return (
    <p style={NOTE_STYLE}>
      {`We'll email your order confirmation to ${maskedEmail ?? 'the address you gave at checkout'}. We'll email you again when it ships.`}
    </p>
  );
}

function ContinueShoppingButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" sweep onClick={onClick} style={{ width: '100%' }}>
      Continue shopping
    </Button>
  );
}

export default function CheckoutConfirmationPage() {
  const router = useRouter();
  const { cartId, hydrated: cartHydrated, subtotalAmount, lines, bundleIndex, clearCart } = useCart();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  /**
   * The placed order, for the receipt below. Kept beside `orderNumber` rather
   * than replacing it because the Instapay flow arrives here with only an
   * `?order=` number in the URL and no order body to show — the number alone
   * still has to render a valid confirmation.
   */
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The cart was checked out but no order came back for it. Its own screen,
   * because the generic one says "Return to checkout" — the one thing a
   * shopper whose order most likely went through must not be told to do.
   */
  const [maybePlaced, setMaybePlaced] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  /** The email a guest typed at checkout, kept past the session being spent. */
  const [guestEmail, setGuestEmail] = useState<string | null>(null);
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
      // The Instapay step remembers the order it placed; with it, the page can
      // show the receipt and tell a guest from a signed-in shopper (#134).
      const placedByInstapay = loadPlacedOrder();
      // Kept once set: this effect re-runs, and a freshly parsed copy each
      // time would be a new object, a re-render and another run — forever.
      if (placedByInstapay?.order.orderNumber === fromQuery) {
        setOrder((prev) => prev ?? placedByInstapay.order);
      }
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
    // A settled failure stays on screen. The effect re-runs whenever the cart
    // provider re-renders, and must not quietly place the order again under
    // an error the shopper is still reading.
    if (error) return;

    const session = loadCheckoutSession();

    // A refresh AFTER the order was placed (#121). The session was spent by
    // that success, so without this the check below read a completed purchase
    // as an abandoned checkout and sent the shopper back to Delivery, to an
    // empty bag. Shown only when no newer checkout is under way in this tab: a
    // live session with a different key is a new order, not this one.
    const placed = loadPlacedOrder();
    if (placed && (!session || session.idempotencyKey === placed.idempotencyKey)) {
      setOrder(placed.order);
      setOrderNumber(placed.order.orderNumber);
      setSessionChecked(true);
      return;
    }

    // A guest carries `guest` where a signed-in shopper carries
    // `shippingAddressId`; either one means the Delivery step was completed.
    // Requiring the id alone sent every guest back to /checkout in a loop.
    // The Delivery step is not complete without a chosen method — and, for
    // SAME_DAY, a resolved location — the same requirement the Payment and
    // InstaPay pages enforce before they will call `apiCheckout`. A session
    // missing either is an interrupted checkout, not a placeable one.
    if (
      !(session?.shippingAddressId || session?.guest) ||
      session.paymentMethod !== 'COD' ||
      !session.deliveryMethod ||
      (session.deliveryMethod === 'SAME_DAY' && !session.deliveryLocation)
    ) {
      router.replace('/checkout');
      return;
    }
    setSessionChecked(true);
    // Read now: placing the order spends the session, and the guest's email
    // is still needed for the "we'll email you" line after that (#134).
    setGuestEmail(session.guest?.email ?? null);

    // On a hard load (a refresh, or the URL opened directly) the bag has not
    // answered yet: `cartId` is '' because nothing has been read, not because
    // the bag is empty. Deciding here used to print "Your bag is empty" — and
    // then, when the cart arrived and re-ran this effect, place the order
    // underneath that message (#121). Wait for the real answer.
    if (!cartHydrated) return;

    // The live bag if there is one; otherwise the cart a previous load of this
    // page already SENT the order against. A refresh mid-placement comes back
    // to a server that has checked that cart out, so GET /v1/cart has no cart
    // to return — but the order may well exist, and replaying the same key
    // against the same cart is how to get it back.
    const placeCartId = cartId || session.placingCartId;
    // Same reason as the Instapay page: an order is placed against a cart, so
    // without one there is nothing to place and the API answers
    // "cartId: Invalid uuid" after the customer has already been told to wait.
    if (!placeCartId) {
      setError('Your bag is empty. Add something to it before placing an order.');
      return;
    }
    submitted.current = true;
    const isReplay = placeCartId === session.placingCartId;
    // One key for this checkout, minted once and kept in the session — the
    // replay below and any refresh send exactly this one.
    const idempotencyKey = checkoutIdempotencyKey();
    saveCheckoutSession({ placingCartId: placeCartId });

    // Fired immediately before the order POST — never `purchase`, which is
    // emitted server-side only, inside the order transaction, so tracked
    // revenue reconciles exactly with the `orders` table. Not fired again for
    // a replay of an order already sent: that is the same attempt, re-asked.
    if (!isReplay) {
      // Fired asynchronously so a slow settings/discount read never delays
      // Place order itself — the event lands a beat later with the real
      // total, never at the cost of holding up the actual checkout call.
      void realOrderTotalMinor(subtotalAmount, toPricingLines(lines, bundleIndex)).then(
        (totalMinor) => {
          track('payment_initiated', { method: 'COD', cartId: placeCartId, totalMinor });
        },
      );
    }

    const body = {
      cartId: placeCartId,
      ...(session.guest
        ? guestCheckoutFields(session.guest)
        : { shippingAddressId: session.shippingAddressId }),
      paymentMethod: 'COD' as const,
      // Whatever they applied in the bag or on the payment step. The server
      // re-resolves it and recomputes the saving; no code means no discount.
      // A code that no longer applies is refused with a 422 — never
      // silently charged at full price (minirue-backend#120).
      ...(loadAppliedCode() ? { discountCode: loadAppliedCode()! } : {}),
      // The Delivery step's choice, carried through the session — the guard
      // above already refused to reach this point without it.
      deliveryMethod: session.deliveryMethod!,
      ...(session.deliveryLocation ? { deliveryLocation: session.deliveryLocation } : {}),
    };

    // "Cart already checked out" is retried with the SAME key: the server
    // records the key a moment after it claims the cart, so a replay can land
    // in between. Repeating it can never create an order — the cart is gone —
    // only find the one that exists.
    void placeWithReplay(() => apiCheckout(body, idempotencyKey), REPLAY_DELAYS_MS)
      .then((order) => {
        trackMetaPixelEvent(
          'Purchase',
          {
            value: Number(order.totalAmount),
            currency: order.totalCurrency,
            content_ids: (order.items ?? []).map((item) => item.variantId),
            content_type: 'product',
            num_items: (order.items ?? []).reduce((sum, item) => sum + item.qty, 0),
          },
          `purchase:${order.id}`,
        );
        // Remembered BEFORE the session is spent, so a refresh from here on
        // shows this order rather than an abandoned checkout.
        savePlacedOrder(order, idempotencyKey);
        setOrderNumber(order.orderNumber);
        setOrder(order);
        clearCheckoutSession();
        // Forgotten once it has been spent. Leaving it behind would silently
        // re-apply a one-use code to the next order and fail at placement.
        saveAppliedCode(null);
        void clearCart();
      })
      .catch((err: unknown) => {
        if (isCartAlreadyCheckedOut(err)) {
          // Still no order after every replay. The bag was bought, most
          // likely by this very checkout; the honest screen says so and
          // points at the orders (or, for a guest, their email), never back
          // at Place order.
          const message = session.guest
            ? "This bag has already been placed as an order. Please don't order it again."
            : 'This bag has already been placed as an order. Check your email or your orders before ordering again.';
          setMaybePlaced(true);
          setError(message);
          track('payment_client_error', { method: 'COD', message });
          return;
        }
        // A 422 carries `message` as an array of {field, issue}; printing it
        // straight gave the customer "[object Object]".
        const message =
          codeRefusalAtPlacement(err) ??
          formatApiError(err, 'Checkout failed. Please try again.');
        setError(message);
        track('payment_client_error', { method: 'COD', message });
        submitted.current = false;
      });
    // `orderNumber` is read by the guard above but deliberately NOT a
    // dependency: adding it would re-run this effect the moment the order
    // lands, which is the re-entrancy the guard exists to absorb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId, cartHydrated, clearCart, router]);

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

  // Only read once an effect has settled the page (every branch below), so
  // the server render never sees the sign-in cookie.
  const buyer: OrderBuyer = orderBuyer(order, { guestEmail, signedIn: isAuthenticated() });

  if (error && maybePlaced) {
    return (
      <CheckoutShell>
        <CheckoutPageFrame step={4} complete title="Your order may already be placed" maxWidth={480}>
          <CheckoutAlert variant="warning">{error}</CheckoutAlert>
          {buyer.kind === 'guest' ? (
            <>
              <GuestEmailNote maskedEmail={buyer.maskedEmail} />
              <ContinueShoppingButton onClick={() => router.push('/shop/all')} />
            </>
          ) : (
            <Button variant="primary" sweep onClick={() => router.push('/account/orders')} style={{ width: '100%' }}>
              View your orders
            </Button>
          )}
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
            ? buyer.kind === 'guest'
              ? // The email line below says where it goes; not twice.
                'Thank you for shopping with MiniRue.'
              : 'Thank you for shopping with MiniRue. A confirmation email will arrive shortly.'
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
              <div
                style={{
                  margin: '0 0 var(--mr-sp-5)',
                  padding: 'var(--mr-sp-5) 0 0',
                  borderTop: '1px solid var(--mr-hairline)',
                }}
              >
                {/* One line per thing bought: a set is its own image, name
                    and price, never its members (#116). */}
                <OrderLineList items={order.items} currency={order.totalCurrency} variant="receipt" />
              </div>
            ) : null}

            <SetSavingsRow
              amount={order?.bundleSavingsAmount}
              currency={order?.totalCurrency ?? 'EGP'}
              style={{ padding: 'var(--mr-sp-3) 0', borderTop: '1px solid var(--mr-hairline)' }}
            />

            {/*
              What was chosen at the Delivery step, shown right after purchase
              rather than only once the shopper opens their orders (#163's
              "Fixed when": order status shows delivery info immediately).
              Absent when the order predates this or the backend hasn't sent
              it yet — `OrderDeliveryInfo` renders nothing in that case.
            */}
            <OrderDeliveryInfo delivery={order?.delivery} currency={order?.totalCurrency ?? 'EGP'} />

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
                  {formatMoney(order.totalAmount, order.totalCurrency)}
                </span>
              </div>
            )}

            {/*
              What happens next, in the shopper's terms. "Cash on delivery"
              is the one thing a COD customer must know before the courier is
              at the door with their hand out, and it is the single most common
              support message this shop gets after an order.
            */}
            {/*
              A guest has no account and no order page (#134, backend#135):
              they hear where the order emails go, and are offered the shop.
              "We'll email", not "we've emailed" — the checkout response does
              not say an email was sent.
            */}
            {buyer.kind === 'guest' ? (
              <>
                <GuestEmailNote maskedEmail={buyer.maskedEmail} />
                <ContinueShoppingButton onClick={() => router.push('/shop/all')} />
              </>
            ) : (
              <>
                <p style={NOTE_STYLE}>
                  We&apos;re preparing your order now. You&apos;ll get a message when it
                  ships, and you can follow it any time from your orders.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
                  <Button
                    variant="primary"
                    sweep
                    onClick={() =>
                      router.push(
                        buyer.orderId
                          ? `/account/orders/${encodeURIComponent(buyer.orderId)}`
                          : '/account/orders',
                      )
                    }
                    style={{ width: '100%' }}
                  >
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
              </>
            )}
          </div>
        )}
      </CheckoutPageFrame>
    </CheckoutShell>
  );
}

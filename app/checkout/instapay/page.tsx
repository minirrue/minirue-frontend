'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { toPricingLines } from '@/components/storefront/cart/bag-lines';
import { apiCheckout, guestCheckoutFields } from '@/lib/checkout/checkout-api';
import {
  codeRefusalAtPlacement,
  loadAppliedCode,
  saveAppliedCode,
} from '@/lib/api/discounts';
import { formatApiError } from '@/lib/api/client';
import {
  clearCheckoutSession,
  loadCheckoutSession,
  checkoutIdempotencyKey,
  saveCheckoutSession,
} from '@/lib/checkout/checkout-session';
import { realOrderTotalMinor } from '@/lib/checkout/real-order-total';
import { savePlacedOrder } from '@/lib/checkout/placed-order';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutPageFrame from '@/components/checkout/CheckoutPageFrame';
import {
  CheckoutActions,
  CheckoutAlert,
  CheckoutFileDrop,
  CheckoutSection,
} from '@/components/checkout/checkout-ui';
import { track } from '@/lib/analytics';
import { RECEIPT_ACCEPT, RECEIPT_HINT } from '@/lib/checkout/receipt-formats';
import InstapayGuide, { useInstapayGuide } from '@/components/checkout/InstapayGuide';
import { useEffectiveShipping } from '@/components/storefront/cart/use-bag-pricing';
import { previewDiscount } from '@/lib/api/discounts';
import { subtotalToMinor } from '@/lib/checkout/checkout-money';
import { shippingSummary } from '@/lib/checkout/shipping-summary';
import { formatMoney } from '@/lib/format/money';
import { totalMinorForDelivery } from '@/lib/checkout/delivery-summary';
import type { DeliveryMethod } from '@/lib/checkout/delivery';

/**
 * The figure to transfer, worked out the way the Payment step's "Order total"
 * is: the governorate's delivery fee and the discount the server would apply.
 * One discount preview per visit — a coded preview already folds in any
 * automatic offer — and `null` until it has answered, so the amount a shopper
 * copies into their bank app never changes under them.
 */
function useTransferAmountMinor(
  subtotalAmount: string,
  pricingLines: ReturnType<typeof toPricingLines>,
): number | null {
  const effective = useEffectiveShipping();
  const [priced, setPriced] = useState<{ governorate?: string; discountMinor: number } | null>(null);
  const hasLines = pricingLines.length > 0;
  const linesRef = useRef(pricingLines);
  useEffect(() => {
    linesRef.current = pricingLines;
  });

  useEffect(() => {
    if (!hasLines) return;
    const session = loadCheckoutSession();
    const governorate = session?.shippingGovernorate;
    let cancelled = false;
    previewDiscount(linesRef.current, loadAppliedCode(), { guestPhone: session?.guest?.phone })
      .then((preview) => (preview.valid ? preview.discountMinor : 0))
      // Same fallback as the Payment step: no discount row. The server
      // recomputes the real total at Place order either way.
      .catch(() => 0)
      .then((discountMinor) => {
        if (!cancelled) setPriced({ governorate, discountMinor });
      });
    return () => {
      cancelled = true;
    };
  }, [hasLines]);

  if (priced === null) return null;
  const summary = shippingSummary({
    effective,
    subtotalMinor: subtotalToMinor(subtotalAmount),
    discountMinor: priced.discountMinor,
    governorate: priced.governorate,
  });
  // SAME_DAY transfers goods only — the delivery fee is confirmed after the
  // order and paid in cash on delivery, never transferred up front
  // (frontend#163).
  const goodsMinor = Math.max(0, subtotalToMinor(subtotalAmount) - priced.discountMinor);
  return totalMinorForDelivery(loadCheckoutSession()?.deliveryMethod, goodsMinor, summary.totalMinor);
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export default function InstapayCheckoutPage() {
  const router = useRouter();
  const { cartId, items, lines, bundleIndex, subtotalAmount, currency, hydrated: cartHydrated, clearCart } = useCart();
  const guide = useInstapayGuide();
  const pricingLines = useMemo(
    () => toPricingLines(lines ?? [], bundleIndex ?? new Map()),
    [lines, bundleIndex],
  );
  const amountMinor = useTransferAmountMinor(subtotalAmount, pricingLines);
  // The Delivery step's choice (frontend#163), read once for the transfer
  // note below — same sessionStorage read as the amount hook above.
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | undefined>(undefined);
  useEffect(() => {
    setDeliveryMethod(loadCheckoutSession()?.deliveryMethod);
  }, []);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set the moment the order is accepted. The success path clears the cart, which
  // would otherwise trip the empty-cart guard below and bounce the customer away
  // from the confirmation page they are being sent to.
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A cart is what is being paid for, so no cart means there is nothing to pay.
  // Without this the page still rendered payment after a hard reload dropped the
  // cart, and Submit posted an empty cartId — the customer uploaded a receipt and
  // got back "cartId: Invalid uuid" for their trouble. Wait for the cart to load
  // first, or this would bounce every genuine visit on the first render.
  // `hydrated`, not `!loading`: `loading` is false before the bag has been asked
  // for at all, so a refresh of this step was sent to /cart (same trap as #121).
  const cartEmpty = cartHydrated && !placed && (!cartId || items.length === 0);

  useEffect(() => {
    const session = loadCheckoutSession();
    // See the COD page: a guest has `guest`, not `shippingAddressId`.
    if (
      !(session?.shippingAddressId || session?.guest) ||
      session.paymentMethod !== 'INSTAPAY'
    ) {
      router.replace('/checkout');
      return;
    }
    if (cartEmpty) {
      router.replace('/cart');
    }
  }, [router, cartEmpty]);

  function onFile(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
      setError('Please upload a PNG, JPG, or WebP image.');
      track('checkout_validation_error', {
        step: 'payment',
        field: 'receipt',
        issue: 'unsupported-file-type',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Receipt must be 10 MB or smaller.');
      track('checkout_validation_error', {
        step: 'payment',
        field: 'receipt',
        issue: 'file-too-large',
      });
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      setError('Could not read the file. Please try again.');
    };
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPreview(dataUrl);
      saveCheckoutSession({ receiptDataUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    const session = loadCheckoutSession();
    if (!(session?.shippingAddressId || session?.guest) || !preview) return;
    // Checked again at submit time: the cart can empty out between render and
    // click (another tab, an expired cart), and the redirect above only runs on
    // a state change.
    if (!cartId || items.length === 0) {
      setError('Your bag is empty. Add something to it before paying.');
      return;
    }

    setSubmitting(true);
    setError(null);
    // Fired immediately before the order POST, not after — this is a
    // "the customer tried to pay" signal, distinct from `purchase` (emitted
    // server-side only, inside the order transaction, never from the browser).
    // Fired asynchronously so a slow settings/discount read never delays the
    // order POST below — the event lands a beat later with the real total.
    void realOrderTotalMinor(subtotalAmount, toPricingLines(lines, bundleIndex)).then(
      (totalMinor) => {
        track('payment_initiated', { method: 'INSTAPAY', cartId, totalMinor });
      },
    );
    const idempotencyKey = checkoutIdempotencyKey();
    try {
      const order = await apiCheckout(
        {
          cartId,
          ...(session.guest
            ? guestCheckoutFields(session.guest)
            : { shippingAddressId: session.shippingAddressId }),
          paymentMethod: 'INSTAPAY',
          receiptDataUrl: preview,
          ...(loadAppliedCode() ? { discountCode: loadAppliedCode()! } : {}),
          // Standard / Same-day (frontend#163) — sent explicitly whenever the
          // Delivery step recorded one; `deliveryLocation` only ever travels
          // alongside SAME_DAY.
          ...(session.deliveryMethod ? { deliveryMethod: session.deliveryMethod } : {}),
          ...(session.deliveryMethod === 'SAME_DAY' && session.deliveryLocation
            ? { deliveryLocation: session.deliveryLocation }
            : {}),
        },
        idempotencyKey,
      );
      // Before clearing anything: from here on an empty cart is the expected
      // outcome, not a reason to redirect.
      setPlaced(true);
      // The confirmation gets only `?order=` in the URL. Remembering the order
      // body lets it show the receipt and tell a guest from a signed-in
      // shopper — a guest must never be sent to "your orders" (#134).
      savePlacedOrder(order, idempotencyKey);
      clearCheckoutSession();
      saveAppliedCode(null);
      await clearCart();
      router.replace(`/checkout/confirmation?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (err: unknown) {
      // A refused code (minirue-backend#120): forgotten, and said plainly —
      // the transfer they made may not match the new total.
      const message =
        codeRefusalAtPlacement(err) ?? formatApiError(err, 'Failed to submit receipt.');
      setError(message);
      track('payment_client_error', { method: 'INSTAPAY', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CheckoutShell>
      <CheckoutPageFrame
        step={3}
        eyebrow="Instapay"
        title="Pay with InstaPay"
        subtitle="Send the amount below, then upload a screenshot of the confirmation to place your order."
        maxWidth={520}
      >
        <InstapayGuide
          guide={guide}
          amount={amountMinor === null ? null : formatMoney(amountMinor / 100, currency)}
          amountNote={
            deliveryMethod === 'SAME_DAY'
              ? 'Goods only. Same-day delivery is confirmed after your order and paid in cash on delivery.'
              : 'Includes delivery and any discount. Send the exact amount.'
          }
        />

        <CheckoutSection title="Payment proof">
          <CheckoutFileDrop
            accept={RECEIPT_ACCEPT}
            onFile={onFile}
            preview={preview}
            hint={RECEIPT_HINT}
          />
        </CheckoutSection>

        {error && (
          <CheckoutAlert variant="error">
            <span>{error}</span>
            {preview && !submitting ? (
              <button
                type="button"
                onClick={() => void submit()}
                style={{
                  display: 'block',
                  marginTop: 'var(--mr-sp-2)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'inherit',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Retry submission
              </button>
            ) : null}
          </CheckoutAlert>
        )}

        <p
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-xs)',
            color: 'var(--mr-fg-4)',
            lineHeight: 1.55,
            marginTop: 'var(--mr-sp-4)',
          }}
        >
          Your order will be held until our team verifies the payment. You will receive email updates
          once approved.
        </p>

        <CheckoutActions
          primaryLabel={submitting ? 'Submitting…' : 'Submit & place order'}
          primaryDisabled={!preview}
          primaryLoading={submitting}
          onPrimary={() => void submit()}
          backHref="/checkout/payment"
          backLabel="Back to payment"
        />
      </CheckoutPageFrame>
    </CheckoutShell>
  );
}

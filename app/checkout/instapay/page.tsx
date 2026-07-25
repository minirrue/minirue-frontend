'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { apiCheckout } from '@/lib/checkout/checkout-api';
import { formatApiError } from '@/lib/api/client';
import {
  clearCheckoutSession,
  loadCheckoutSession,
  newIdempotencyKey,
  saveCheckoutSession,
} from '@/lib/checkout/checkout-session';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutPageFrame from '@/components/checkout/CheckoutPageFrame';
import {
  CheckoutActions,
  CheckoutAlert,
  CheckoutFileDrop,
  CheckoutSection,
} from '@/components/checkout/checkout-ui';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export default function InstapayCheckoutPage() {
  const router = useRouter();
  const { cartId, items, loading: cartLoading, clearCart } = useCart();
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
  const cartEmpty = !cartLoading && !placed && (!cartId || items.length === 0);

  useEffect(() => {
    const session = loadCheckoutSession();
    if (!session?.shippingAddressId || session.paymentMethod !== 'INSTAPAY') {
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
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Receipt must be 10 MB or smaller.');
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
    if (!session?.shippingAddressId || !preview) return;
    // Checked again at submit time: the cart can empty out between render and
    // click (another tab, an expired cart), and the redirect above only runs on
    // a state change.
    if (!cartId || items.length === 0) {
      setError('Your bag is empty. Add something to it before paying.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const order = await apiCheckout(
        {
          cartId,
          shippingAddressId: session.shippingAddressId,
          paymentMethod: 'INSTAPAY',
          receiptDataUrl: preview,
        },
        newIdempotencyKey(),
      );
      // Before clearing anything: from here on an empty cart is the expected
      // outcome, not a reason to redirect.
      setPlaced(true);
      clearCheckoutSession();
      await clearCart();
      router.replace(`/checkout/confirmation?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (err: unknown) {
      setError(formatApiError(err, 'Failed to submit receipt.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CheckoutShell>
      <CheckoutPageFrame
        step={3}
        eyebrow="Instapay"
        title="Upload your receipt"
        subtitle="Complete the transfer in your banking app, then upload a clear screenshot or photo of the confirmation."
        maxWidth={520}
      >
        <CheckoutSection title="Payment proof">
          <CheckoutFileDrop
            accept="image/png,image/jpeg,image/webp"
            onFile={onFile}
            preview={preview}
            hint="PNG, JPG, or WebP · max 10 MB · drag and drop supported"
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

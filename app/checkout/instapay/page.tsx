'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { apiCheckout } from '@/lib/checkout/checkout-api';
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
  const { cartId, clearCart } = useCart();
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadCheckoutSession();
    if (!session?.shippingAddressId || session.paymentMethod !== 'INSTAPAY') {
      router.replace('/checkout');
    }
  }, [router]);

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
      clearCheckoutSession();
      await clearCart();
      router.replace(`/checkout/confirmation?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to submit receipt.';
      setError(message);
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

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useCart } from '@/components/storefront/cart/CartContext';
import type { OrderSummary } from '@/lib/checkout/checkout-api';
import { executeRebuyPlan, loadRebuyPlan, saveRebuyResult } from '@/lib/orders/rebuy';

type Rejection = NonNullable<OrderSummary['paymentRejection']>;

const REJECTION_COPY: Record<Rejection['reason'], string> = {
  RECEIPT_UNREADABLE:
    'We could not clearly read the receipt. Place the order again and upload a sharp screenshot that shows the full transfer.',
  AMOUNT_MISMATCH:
    'The transferred amount did not match the order total. Place the order again using the exact total shown at checkout.',
  REFERENCE_NOT_FOUND:
    'We could not find the transfer reference on the receipt. Place the order again with a screenshot that clearly shows it.',
  DUPLICATE_RECEIPT:
    'This receipt was already used for another order. Place the order again and upload the receipt for the new transfer.',
  SENDER_NAME_MISMATCH:
    'The sender name did not match the transfer details. Check the account used, then place the order again.',
  OTHER:
    'We could not verify this transfer. Review the note below, then place the order again when you are ready.',
};

export function rejectionMessage(reason: Rejection['reason']): string {
  return REJECTION_COPY[reason];
}

export default function PaymentRejectionPanel({ order }: { order: OrderSummary }) {
  const router = useRouter();
  const { items, loading: cartBusy } = useCart();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const rejection = order.paymentRejection;

  if (!rejection) return null;

  const rebuy = async () => {
    if (busy || cartBusy) return;
    setBusy(true);
    setError(null);
    try {
      const plan = await loadRebuyPlan(order.items, items);
      const result = await executeRebuyPlan(plan);
      saveRebuyResult(result);
      window.dispatchEvent(new Event('mr-cart-sync'));
      router.push('/cart?rebuy=1');
    } catch {
      setError("We couldn't check today's stock. Please try again in a moment.");
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="payment-rejection-title"
      style={{
        marginTop: 24,
        padding: 'var(--mr-sp-5)',
        borderRadius: 'var(--mr-radius-md)',
        background: 'rgba(142,20,24,0.07)',
        color: 'var(--mr-fg)',
      }}
    >
      <h2
        id="payment-rejection-title"
        style={{
          margin: 0,
          fontFamily: 'var(--mr-font-serif)',
          fontSize: 'var(--mr-text-lg)',
          fontWeight: 500,
          color: 'var(--mr-danger)',
        }}
      >
        Your InstaPay payment needs attention
      </h2>
      <p style={{ margin: 'var(--mr-sp-2) 0 0', maxWidth: '68ch', lineHeight: 1.6 }}>
        {rejectionMessage(rejection.reason)}
      </p>
      {rejection.note && (
        <p
          style={{
            margin: 'var(--mr-sp-3) 0 0',
            paddingTop: 'var(--mr-sp-3)',
            borderTop: '1px solid rgba(142,20,24,0.18)',
            color: 'var(--mr-fg-2)',
            fontSize: 'var(--mr-text-sm)',
            lineHeight: 1.6,
            overflowWrap: 'anywhere',
          }}
        >
          <strong style={{ color: 'var(--mr-fg)', fontWeight: 500 }}>MiniRue note:</strong>{' '}
          {rejection.note}
        </p>
      )}
      <div style={{ marginTop: 'var(--mr-sp-4)' }}>
        <Button
          onClick={() => void rebuy()}
          disabled={busy || cartBusy}
          ariaLabel={busy ? 'Adding this order to your bag' : 'Buy this order again'}
          traceId="PG-ACCOUNT-ORDER-DETAIL::EL-BTN-rebuy-order"
        >
          {busy ? 'Checking availability…' : 'Buy again'}
        </Button>
      </div>
      {error && (
        <p role="alert" style={{ margin: 'var(--mr-sp-3) 0 0', color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)' }}>
          {error}
        </p>
      )}
    </section>
  );
}

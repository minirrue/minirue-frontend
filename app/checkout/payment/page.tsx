'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { loadCheckoutSession, saveCheckoutSession } from '@/lib/checkout/checkout-session';
import {
  COD_MAX_ORDER_MINOR,
  isCodAvailable,
  orderTotalMinor,
  SHIPPING_AMOUNT_MINOR,
} from '@/lib/checkout/checkout-schemas';
import { track } from '@/lib/analytics';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutPageFrame from '@/components/checkout/CheckoutPageFrame';
import {
  CheckoutActions,
  CheckoutAlert,
  CheckoutOption,
  CheckoutSection,
  CheckoutSummaryCard,
} from '@/components/checkout/checkout-ui';
import PriceDisplay from '@/components/storefront/PriceDisplay';
import DiscountCodeField from '@/components/checkout/DiscountCodeField';
import type { DiscountPreview } from '@/lib/api/discounts';

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { cartId, items, subtotalAmount, currency } = useCart();
  const [method, setMethod] = useState<'COD' | 'INSTAPAY'>('COD');
  const [discount, setDiscount] = useState<DiscountPreview | null>(null);

  /**
   * The last chance to type a code before paying. The field re-checks whatever
   * was applied in the bag, so a shopper who applied it there sees it here
   * already filled in rather than an empty box that looks like it was lost.
   */
  const discountLines = useMemo(
    () =>
      items.map((i) => ({
        variantId: i.variantId,
        qty: i.qty,
        unitPriceMinor: Math.round(parseFloat(i.unitPriceAmount) * 100),
      })),
    [items],
  );

  useEffect(() => {
    if (!loadCheckoutSession()?.shippingAddressId) {
      router.replace('/checkout');
    }
  }, [router]);

  const firedStepView = useRef(false);
  useEffect(() => {
    if (firedStepView.current) return;
    firedStepView.current = true;
    track('checkout_step_view', { step: 'payment', cartId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preselect whatever the shopper already chose on a previous pass through
  // this step, same as the delivery step does for the address — otherwise
  // going back from payment and forward again silently resets to COD.
  useEffect(() => {
    const saved = loadCheckoutSession()?.paymentMethod;
    if (saved) setMethod(saved);
  }, []);

  const discountMinor = discount?.discountMinor ?? 0;
  /**
   * Both the COD ceiling and the displayed total follow what is actually paid.
   * That is the cash the courier collects, and judging the ceiling on the
   * pre-discount figure would refuse cash on delivery for an order small enough
   * to qualify.
   */
  const totalMinor = Math.max(0, orderTotalMinor(subtotalAmount) - discountMinor);
  const codBlocked = totalMinor > COD_MAX_ORDER_MINOR;

  useEffect(() => {
    if (codBlocked && method === 'COD') {
      setMethod('INSTAPAY');
    }
  }, [codBlocked, method]);

  return (
    <CheckoutShell>
      <CheckoutPageFrame
        step={3}
        eyebrow="Step 3 of 4"
        title="Payment"
        subtitle="Select how you would like to pay. Instapay orders require a receipt upload on the next screen."
        maxWidth={560}
      >
        <CheckoutSummaryCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-3)',
              }}
            >
              Order total
            </span>
            <PriceDisplay
              amount={minorToAmount(totalMinor)}
              currency={currency}
              style={{ fontSize: 'var(--mr-text-lg)', color: 'var(--mr-fg)' }}
            />
          </div>
          <p
            style={{
              margin: 'var(--mr-sp-2) 0 0',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
            }}
          >
            Includes shipping ({minorToAmount(SHIPPING_AMOUNT_MINOR)} {currency})
            {discountMinor > 0 && (
              <>
                {' · '}
                {discount?.code} −{minorToAmount(discountMinor)} {currency}
              </>
            )}
          </p>
        </CheckoutSummaryCard>

        <CheckoutSection title="Discount code">
          <DiscountCodeField lines={discountLines} onChange={setDiscount} compact />
        </CheckoutSection>

        <CheckoutSection title="Payment method">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
            <CheckoutOption
              name="payment"
              checked={method === 'COD'}
              disabled={codBlocked}
              onChange={() => setMethod('COD')}
              title="Cash on delivery"
              description="Pay when your order arrives. Available for orders up to a set limit."
            />
            {codBlocked && (
              <CheckoutAlert variant="warning">
                Cash on delivery is not available above{' '}
                {minorToAmount(COD_MAX_ORDER_MINOR)} {currency}. Please use Instapay.
              </CheckoutAlert>
            )}
            <CheckoutOption
              name="payment"
              checked={method === 'INSTAPAY'}
              onChange={() => setMethod('INSTAPAY')}
              title="Instapay"
              description="Transfer via Instapay, then upload your receipt for verification."
              badge="Recommended"
            />
          </div>
        </CheckoutSection>

        <CheckoutActions
          primaryLabel="Continue"
          onPrimary={() => {
            saveCheckoutSession({ paymentMethod: method });
            track('checkout_payment_selected', { method });
            router.push(method === 'INSTAPAY' ? '/checkout/instapay' : '/checkout/confirmation');
          }}
          backHref="/checkout"
          backLabel="Back to delivery"
        />
      </CheckoutPageFrame>
    </CheckoutShell>
  );
}

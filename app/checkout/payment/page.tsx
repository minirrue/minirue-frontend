'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { loadCheckoutSession, saveCheckoutSession } from '@/lib/checkout/checkout-session';
import {
  COD_MAX_ORDER_MINOR,
  isCodAvailable,
  orderTotalMinor,
  SHIPPING_AMOUNT_MINOR,
} from '@/lib/checkout/checkout-schemas';
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

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { subtotalAmount, currency } = useCart();
  const [method, setMethod] = useState<'COD' | 'INSTAPAY'>('COD');

  useEffect(() => {
    if (!loadCheckoutSession()?.shippingAddressId) {
      router.replace('/checkout');
    }
  }, [router]);

  const codBlocked = !isCodAvailable(subtotalAmount);
  const totalMinor = orderTotalMinor(subtotalAmount);

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
          </p>
        </CheckoutSummaryCard>

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
            router.push(method === 'INSTAPAY' ? '/checkout/instapay' : '/checkout/confirmation');
          }}
          backHref="/checkout"
          backLabel="Back to delivery"
        />
      </CheckoutPageFrame>
    </CheckoutShell>
  );
}

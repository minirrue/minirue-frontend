'use client';

import {
  CheckoutAlert,
  CheckoutOption,
  CheckoutSection,
} from './checkout-ui';
import {
  COD_MAX_ORDER_MINOR,
  isCodAvailable,
} from '@/lib/checkout/checkout-schemas';

export interface PaymentMethodSelectorProps {
  method: 'COD' | 'INSTAPAY';
  onChange: (method: 'COD' | 'INSTAPAY') => void;
  subtotalAmount: string;
  currency: string;
}

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function PaymentMethodSelector({
  method,
  onChange,
  subtotalAmount,
  currency,
}: PaymentMethodSelectorProps) {
  const codBlocked = !isCodAvailable(subtotalAmount);

  return (
    <CheckoutSection title="Payment method">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
        <CheckoutOption
          name="payment"
          checked={method === 'COD'}
          disabled={codBlocked}
          onChange={() => onChange('COD')}
          title="Cash on delivery"
          description="Pay when your order arrives. Available for orders up to a set limit."
        />
        {codBlocked && (
          <CheckoutAlert variant="warning">
            Cash on delivery is not available above {minorToAmount(COD_MAX_ORDER_MINOR)}{' '}
            {currency}. Please use Instapay.
          </CheckoutAlert>
        )}
        <CheckoutOption
          name="payment"
          checked={method === 'INSTAPAY'}
          onChange={() => onChange('INSTAPAY')}
          title="Instapay"
          description="Transfer via Instapay, then upload your receipt for verification."
          badge="Recommended"
        />
      </div>
    </CheckoutSection>
  );
}

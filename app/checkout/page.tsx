'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { useCustomerAddresses } from '@/lib/hooks/use-customer';
import { getAccessToken } from '@/lib/auth/tokens';
import { saveCheckoutSession } from '@/lib/checkout/checkout-session';
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
import Button from '@/components/ui/Button';
import { SHIPPING_AMOUNT_MINOR, orderTotalMinor } from '@/lib/checkout/checkout-schemas';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cartId, itemCount, subtotalAmount, currency } = useCart();
  const { data: addresses, isLoading } = useCustomerAddresses();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { mobile } = useBreakpoint();

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace(`/login?returnUrl=${encodeURIComponent('/checkout')}`);
    }
  }, [router]);

  useEffect(() => {
    if (!addresses?.length) return;
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
    setSelectedId((prev) => prev ?? defaultAddr.id);
  }, [addresses]);

  if (itemCount === 0) {
    return (
      <CheckoutShell>
        <CheckoutPageFrame
          step={2}
          eyebrow="Checkout"
          title="Your bag is empty"
          subtitle="Add a fragrance before continuing to delivery."
        >
          <Button variant="primary" sweep onClick={() => router.push('/products')} style={{ width: '100%' }}>
            Browse collection
          </Button>
        </CheckoutPageFrame>
      </CheckoutShell>
    );
  }

  const totalMinor = orderTotalMinor(subtotalAmount);

  return (
    <CheckoutShell>
      <CheckoutPageFrame
        step={2}
        eyebrow="Step 2 of 4"
        title="Delivery"
        subtitle="Choose where we should send your order. You can manage saved addresses in your account."
        maxWidth={720}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 1fr) minmax(240px, 280px)',
            gap: 'var(--mr-sp-6)',
            alignItems: 'start',
          }}
        >
          <CheckoutSection title="Shipping address">
            {isLoading && (
              <p
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-sm)',
                  color: 'var(--mr-fg-3)',
                  fontStyle: 'italic',
                }}
              >
                Loading your addresses…
              </p>
            )}
            {!isLoading && !addresses?.length && (
              <CheckoutAlert variant="info">
                Add a delivery address in{' '}
                <Link href="/account/addresses" style={{ color: 'inherit', fontWeight: 600 }}>
                  your account
                </Link>{' '}
                before checkout.
              </CheckoutAlert>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
              {addresses?.map((addr) => (
                <CheckoutOption
                  key={addr.id}
                  name="address"
                  checked={selectedId === addr.id}
                  onChange={() => setSelectedId(addr.id)}
                  title={addr.label}
                  description={
                    <>
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''}
                      <br />
                      {addr.city}
                      {addr.postalCode ? ` · ${addr.postalCode}` : ''}
                    </>
                  }
                  badge={addr.isDefault ? 'Default' : undefined}
                />
              ))}
            </div>
          </CheckoutSection>

          <CheckoutSummaryCard>
            <p
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg)',
                margin: '0 0 var(--mr-sp-4)',
              }}
            >
              Order summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--mr-sp-3)' }}>
                <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
                  Subtotal
                </span>
                <PriceDisplay amount={subtotalAmount} currency={currency} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--mr-sp-3)' }}>
                <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
                  Shipping
                </span>
                <PriceDisplay amount={minorToAmount(SHIPPING_AMOUNT_MINOR)} currency={currency} />
              </div>
              <div style={{ height: 1, background: 'var(--mr-hairline)', margin: 'var(--mr-sp-1) 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--mr-fg)',
                  }}
                >
                  Total
                </span>
                <PriceDisplay
                  amount={minorToAmount(totalMinor)}
                  currency={currency}
                  style={{ fontSize: 'var(--mr-text-lg)', color: 'var(--mr-fg)' }}
                />
              </div>
            </div>
            <p
              style={{
                marginTop: 'var(--mr-sp-4)',
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-4)',
              }}
            >
              Cart ref · {cartId.slice(0, 8)}
            </p>
          </CheckoutSummaryCard>
        </div>

        <CheckoutActions
          primaryLabel="Continue to payment"
          primaryDisabled={!selectedId}
          onPrimary={() => {
            if (!selectedId) return;
            saveCheckoutSession({ shippingAddressId: selectedId });
            router.push('/checkout/payment');
          }}
          backHref="/cart"
          backLabel="Back to bag"
        />
      </CheckoutPageFrame>
    </CheckoutShell>
  );
}

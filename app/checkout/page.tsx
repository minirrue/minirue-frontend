'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { useCustomerAddresses } from '@/lib/hooks/use-customer';
import { isAuthenticated } from '@/lib/auth/tokens';
import {
  loadCheckoutSession,
  saveCheckoutSession,
  type GuestCheckoutDetails,
} from '@/lib/checkout/checkout-session';
import GuestDetailsForm, {
  EMPTY_GUEST,
  validateGuest,
  type GuestFieldErrors,
} from '@/components/checkout/GuestDetailsForm';
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
import { SHIPPING_AMOUNT_MINOR, orderTotalMinor, subtotalToMinor } from '@/lib/checkout/checkout-schemas';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { track } from '@/lib/analytics';

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cartId, itemCount, subtotalAmount, currency } = useCart();
  const { data: addresses, isLoading } = useCustomerAddresses();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { mobile } = useBreakpoint();

  /**
   * Signed in, or checking out as a guest.
   *
   * Resolved in an effect rather than during render because `isAuthenticated`
   * reads a cookie, which does not exist on the server — reading it inline
   * would make the first client render disagree with the HTML and hydration
   * would throw. `null` means "not known yet" and renders neither branch, so
   * a signed-in shopper never sees a guest form flash past.
   */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [guest, setGuest] = useState<GuestCheckoutDetails>(EMPTY_GUEST);
  const [guestErrors, setGuestErrors] = useState<GuestFieldErrors>({});

  // `begin_checkout` fires once, the moment there is a real cart to check out
  // with — not on the render that still shows the "your bag is empty" dead
  // end below. `checkout_step_view` piggybacks on the same guard since this
  // whole page is the "address" step.
  const firedEntry = useRef(false);
  useEffect(() => {
    if (firedEntry.current || itemCount === 0 || !cartId) return;
    firedEntry.current = true;
    track('begin_checkout', {
      cartId,
      itemCount,
      subtotalMinor: subtotalToMinor(subtotalAmount),
    });
    track('checkout_step_view', { step: 'address', cartId });
  }, [cartId, itemCount, subtotalAmount]);

  /**
   * No sign-in wall. This used to `router.replace` a guest to /login, on the
   * reasoning that checkout needs saved addresses and an order needs an owner
   * — and both premises are now false: a guest types their address here, and
   * an order can belong to a guest_contact instead of a user (owner,
   * 2026-08-21: "he can order normally as a guest").
   *
   * The redirect was also the reason this screen hung on "Loading your
   * addresses…" for guests: `useCustomerAddresses` fired, got a 401, and the
   * navigation it was racing had not landed yet.
   */
  useEffect(() => {
    const authed = isAuthenticated();
    setSignedIn(authed);
    if (!authed) {
      // Coming back from Payment, or reloading mid-flow: rehydrate whatever
      // they already typed rather than making them type it twice.
      const saved = loadCheckoutSession()?.guest;
      if (saved) setGuest(saved);
    }
  }, []);

  useEffect(() => {
    if (!addresses?.length) return;
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
    // Prefer whatever the shopper already picked on a previous pass through
    // this step (saved to sessionStorage on "Continue to payment"), so
    // going back and forward is lossless. A saved id that no longer exists
    // in the customer's address list (deleted since, or from a stale
    // session) falls back to the default rather than leaving nothing
    // selected.
    const savedId = loadCheckoutSession()?.shippingAddressId;
    const savedAddr = savedId ? addresses.find((a) => a.id === savedId) : undefined;
    setSelectedId((prev) => prev ?? savedAddr?.id ?? defaultAddr.id);
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
          <Button variant="primary" sweep onClick={() => router.push('/shop/all')} style={{ width: '100%' }}>
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
            // minmax(0, 1fr), not a bare '1fr' — identical bug to /cart, and the
              // reason the overflow ran the whole checkout flow rather than one
              // screen. See app/cart/page.tsx for the full explanation.
              gridTemplateColumns: mobile
                ? 'minmax(0, 1fr)'
                : 'minmax(0, 1fr) minmax(240px, 280px)',
            gap: 'var(--mr-sp-6)',
            alignItems: 'start',
          }}
        >
          <CheckoutSection title="Shipping address">
            {signedIn === false && (
              <>
                <GuestDetailsForm
                  value={guest}
                  onChange={(next) => {
                    setGuest(next);
                    // Errors clear as the shopper types, but never APPEAR that
                    // way: validating on every keystroke tells someone their
                    // email is invalid while they are still typing the @.
                    if (Object.keys(guestErrors).length) {
                      setGuestErrors(validateGuest(next));
                    }
                  }}
                  errors={guestErrors}
                  mobile={mobile}
                />
                <p
                  style={{
                    marginTop: 'var(--mr-sp-5)',
                    fontFamily: 'var(--mr-font-ui)',
                    fontSize: 'var(--mr-text-sm)',
                    color: 'var(--mr-fg-3)',
                  }}
                >
                  Have an account?{' '}
                  <Link
                    href={`/login?next=${encodeURIComponent('/checkout')}`}
                    style={{ color: 'inherit', fontWeight: 600 }}
                  >
                    Sign in
                  </Link>{' '}
                  to use a saved address and a discount code.
                </p>
              </>
            )}
            {signedIn === true && isLoading && (
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
            {signedIn === true && !isLoading && !addresses?.length && (
              <CheckoutAlert variant="info">
                Add a delivery address in{' '}
                <Link href="/account/addresses" style={{ color: 'inherit', fontWeight: 600 }}>
                  your account
                </Link>{' '}
                before checkout.
              </CheckoutAlert>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
              {signedIn === true &&
                addresses?.map((addr) => (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--mr-sp-3)', minWidth: 0 }}>
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
          /**
           * Enabled for a guest even with an empty form, on purpose. A button
           * that is disabled with no stated reason is the exact complaint this
           * shop already had about Add to bag — pressing it and being shown
           * which fields are missing teaches more than a dead control does.
           */
          primaryDisabled={signedIn === null || (signedIn && !selectedId)}
          onPrimary={() => {
            if (signedIn === false) {
              const errors = validateGuest(guest);
              if (Object.keys(errors).length) {
                setGuestErrors(errors);
                // Send focus to the first problem rather than leaving the
                // shopper to hunt for it below the fold on a phone.
                const first = Object.keys(errors)[0];
                document.getElementById(first)?.focus();
                return;
              }
              setGuestErrors({});
              saveCheckoutSession({ guest, shippingAddressId: undefined });
              track('checkout_address_entered', { cartId, hasAddress: true });
              track('checkout_shipping_selected', { method: 'STANDARD', cartId });
              router.push('/checkout/payment');
              return;
            }

            if (!selectedId) return;
            saveCheckoutSession({ shippingAddressId: selectedId, guest: undefined });
            track('checkout_address_entered', { cartId, hasAddress: true });
            // This shop has one flat shipping rate — there is no separate
            // picker screen, so "selected" is recorded here, the moment the
            // shopper commits to the step that carries it.
            track('checkout_shipping_selected', { method: 'STANDARD', cartId });
            router.push('/checkout/payment');
          }}
          backHref="/cart"
          backLabel="Back to bag"
        />
      </CheckoutPageFrame>
    </CheckoutShell>
  );
}

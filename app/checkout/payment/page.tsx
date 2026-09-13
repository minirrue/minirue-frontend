'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { toPricingLines } from '@/components/storefront/cart/bag-lines';
import { loadCheckoutSession, saveCheckoutSession } from '@/lib/checkout/checkout-session';
import {
  useAutomaticDiscount,
  useCodMaxOrderMinor,
  useEffectiveShipping,
} from '@/components/storefront/cart/use-bag-pricing';
import { subtotalToMinor } from '@/lib/checkout/checkout-money';
import { shippingSummary } from '@/lib/checkout/shipping-summary';
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
  const { cartId, lines, bundleIndex, subtotalAmount, currency } = useCart();
  const [method, setMethod] = useState<'COD' | 'INSTAPAY'>('COD');
  const [discount, setDiscount] = useState<DiscountPreview | null>(null);
  const effective = useEffectiveShipping();
  const codMaxMinor = useCodMaxOrderMinor();

  /**
   * The governorate the delivery step settled on (#83), read once after mount.
   *
   * sessionStorage, so it cannot be read during render without the first client
   * render disagreeing with the server's HTML — the same reason `signedIn` is
   * resolved in an effect on the step before this one.
   */
  const [governorate, setGovernorate] = useState<string | undefined>(undefined);
  useEffect(() => {
    setGovernorate(loadCheckoutSession()?.shippingGovernorate);
  }, []);

  /**
   * The last chance to type a code before paying. The field re-checks whatever
   * was applied in the bag, so a shopper who applied it there sees it here
   * already filled in rather than an empty box that looks like it was lost.
   */
  const discountLines = useMemo(
    () =>
      // `?? []` is not defensive noise: this is an optional field on the page
      // that takes payment. If the cart context is ever mid-load, or a caller
      // supplies a partial one, a discount box must not white-screen the
      // payment step. It renders empty and the shopper still pays.
      // Through `toPricingLines` so each line's `bundleId`/`bundleLineKey`
      // travel with it. Without them every member of a set arrives at
      // `priceBag()` looking like an ordinary line and is counted as
      // discountable, against the bundle page's own "Discount codes do not
      // apply to sets" (#56) — and this is the LAST-chance code field, one
      // screen before the shopper pays.
      toPricingLines(lines ?? [], bundleIndex ?? new Map()),
    [lines, bundleIndex],
  );

  useEffect(() => {
    // A guest completes Delivery by filling in `guest`, not by picking a saved
    // address — checking only for the id bounced every guest back a step.
    const session = loadCheckoutSession();
    if (!session?.shippingAddressId && !session?.guest) {
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

  /*
   * The sitewide discount belongs in this total too (frontend#83).
   *
   * This step priced only a TYPED code, so an automatic sitewide offer that the
   * product card, bag and delivery step all showed vanished from the last
   * summary before Place order — and from the COD check below. The server
   * charged it anyway, so the shopper saw a higher total than they paid.
   *
   * Asked only when no code is applied: a coded preview is already
   * `max(code, automatic)`, so both would count the saving twice.
   */
  const automatic = useAutomaticDiscount(discountLines, !discount && discountLines.length > 0);
  const appliedDiscount = discount ?? automatic;
  const discountMinor = appliedDiscount?.discountMinor ?? 0;
  /**
   * Both the COD ceiling and the displayed total follow what is actually paid.
   * That is the cash the courier collects, and judging the ceiling on the
   * pre-discount figure would refuse cash on delivery for an order small enough
   * to qualify.
   *
   * The delivery half is now the governorate's fee rather than a constant
   * (#83). This screen used to add `SHIPPING_AMOUNT_MINOR` — EGP 50, against a
   * shop charging EGP 100 — so the last number a shopper read before paying was
   * the one furthest from what they were billed.
   *
   * `shippingSummary` applies the discount to the goods and the threshold to
   * whichever figure the shop's `freeShippingBasis` names, so the two are not
   * reasoned about separately here.
   */
  const summary = shippingSummary({
    effective,
    subtotalMinor: subtotalToMinor(subtotalAmount),
    discountMinor,
    governorate,
  });
  const totalMinor = summary.totalMinor;
  /**
   * DECISION 4 of #83 again, as the backstop rather than as the announcement.
   *
   * The delivery step already told the shopper when their governorate put the
   * order over the ceiling, which is where the issue asks for it. This stays
   * because the total can still move HERE — a discount code typed on this
   * screen can bring an order back under the limit, and nothing upstream can
   * know that in advance.
   */
  // `null` = no COD limit set, the default (minirue-backend#105).
  const codBlocked = codMaxMinor !== null && totalMinor > codMaxMinor;

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--mr-sp-3)', minWidth: 0 }}>
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
            {summary.free
              ? 'Includes free delivery'
              : `Includes shipping${
                  summary.resolved?.label ? ` to ${summary.resolved.label}` : ''
                } (${minorToAmount(summary.feeMinor)} ${currency})`}
            {discountMinor > 0 && (
              <>
                {' · '}
                {discount?.code ?? 'Sitewide discount'} −{minorToAmount(discountMinor)} {currency}
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
                {minorToAmount(codMaxMinor ?? 0)} {currency}. Please use Instapay.
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

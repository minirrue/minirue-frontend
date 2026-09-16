'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/components/storefront/cart/CartContext';
import { toPricingLines } from '@/components/storefront/cart/bag-lines';
import {
  useAutomaticDiscount,
  useCodMaxOrderMinor,
  useEffectiveShipping,
} from '@/components/storefront/cart/use-bag-pricing';
import { shippingSummary } from '@/lib/checkout/shipping-summary';
import { useCustomerAddresses, useUpdateCustomerAddress } from '@/lib/hooks/use-customer';
import GovernorateKeySelect from '@/components/checkout/GovernorateKeySelect';
import { useUser } from '@/lib/hooks/use-auth';
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
import { subtotalToMinor } from '@/lib/checkout/checkout-money';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { track } from '@/lib/analytics';
import { loadDeliverySettings } from '@/lib/api/settings';
import {
  DEFAULT_DELIVERY_SETTINGS,
  availableDeliveryMethods,
  resolveDeliveryLocation,
  type DeliveryMethod,
  type DeliverySettings,
} from '@/lib/checkout/delivery';
import { resolveGovernorateKey } from '@/lib/checkout/governorates';
import { SAME_DAY_SHIPPING_LABEL, totalMinorForDelivery } from '@/lib/checkout/delivery-summary';
import DeliveryMethodStep from '@/components/checkout/DeliveryMethodStep';
import type { DeliveryMapPin } from '@/components/checkout/DeliveryMap';

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cartId, itemCount, lines, bundleIndex, subtotalAmount, currency } = useCart();
  const { data: addresses, isLoading } = useCustomerAddresses();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { mobile } = useBreakpoint();
  const updateAddress = useUpdateCustomerAddress();
  /**
   * #158/#163: a saved address whose governorate is legacy free text that
   * does not resolve to one of the 27 closed keys blocks same-day
   * eligibility (and, per the coordinator's 2026-09-15 note, was the exact
   * shape of a live incident — garbage text reaching checkout). Fixed
   * in-place here rather than only linked to /account/addresses, so the
   * shopper is never sent away mid-checkout to fix it.
   */
  const [fixGovernorateError, setFixGovernorateError] = useState<string | null>(null);

  /**
   * The shop's delivery policy, including the per-governorate table (#83).
   *
   * Shared promise with the bag (`use-bag-pricing`), so this screen and the one
   * the shopper just left cannot answer from two different reads that raced.
   */
  const effective = useEffectiveShipping();
  const codMaxMinor = useCodMaxOrderMinor();

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
    // Rehydrate anything typed on a previous pass through this step BEFORE
    // identity settles, so coming back from Payment never shows empty fields
    // for a frame.
    const saved = loadCheckoutSession()?.guest;
    if (saved) setGuest(saved);
  }, []);

  /**
   * Identity comes from the real /auth/me query, NOT from `isAuthenticated()`.
   *
   * `isAuthenticated()` reads the `mr-auth` cookie hint, and that hint is a
   * cache that can be WRONG in exactly the direction that breaks this page: a
   * browser that signed in once, whose session has since died, still carries
   * it. That shopper is a guest in every way that matters, but the hint said
   * signed-in — so this screen showed them the saved-address branch, the
   * address fetch 401'd, and they sat on "Loading your addresses…" forever.
   * Only a reload fixed it, because the 401 had cleared the hint by then
   * (owner, 2026-08-21: "still stale, and on refresh it appears").
   *
   * `useUser()` answers with the server. It also self-corrects: it returns
   * `data: undefined` whenever the query errored, so a dead session reads as
   * "guest" on the FIRST render that knows anything, not the second visit.
   */
  const { data: authUser, isPending: authPending } = useUser();
  useEffect(() => {
    if (authPending) return;
    setSignedIn(!!authUser);
  }, [authUser, authPending]);

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

  /**
   * The same automatic markdown the bag shows, asked for the same bag.
   *
   * This screen used to show `subtotal + SHIPPING_AMOUNT_MINOR` and no discount
   * at all, so a shopper who had just read "Estimated total EGP 769.10" in the
   * bag arrived here and was told EGP 849. Both numbers were wrong in different
   * directions — the constant was EGP 50 while the shop charges EGP 100, and
   * the sitewide markdown was simply missing. A summary that contradicts the
   * screen before it is worse than no summary.
   *
   * Not a second implementation of the discount rules: `previewDiscount` runs
   * the server's own `priceBag()`. A code TYPED in the bag is still not carried
   * here — there is nowhere in the checkout session to put it — so a shopper
   * who typed one sees the automatic figure until the payment step re-applies
   * theirs. That gap predates this change and is called out in the PR.
   *
   * Declared UP HERE, above the empty-bag early return, because these are
   * hooks. They read as belonging beside the summary they feed, and that is
   * exactly the instinct that puts a hook after a conditional return and has it
   * run in some renders and not others.
   */
  const discountLines = useMemo(
    () => toPricingLines(lines ?? [], bundleIndex ?? new Map()),
    [lines, bundleIndex],
  );
  const automatic = useAutomaticDiscount(discountLines, itemCount > 0);
  const discountMinor = automatic?.discountMinor ?? 0;

  const selectedAddress = addresses?.find((a) => a.id === selectedId);

  /**
   * The free text that will actually reach the server — and `undefined` when
   * there is not one yet, which is a different thing from an empty one. See
   * the fuller comment this used to sit under, below where it is used for
   * the summary.
   */
  const governorate: string | undefined =
    signedIn === false
      ? guest.governorate.trim()
        ? guest.governorate
        : undefined
      : (selectedAddress?.governorate ?? undefined);

  /**
   * Standard / Same-day delivery (frontend#163). The shop's policy, loaded
   * once — a failed read is `DEFAULT_DELIVERY_SETTINGS`, never a thrown
   * error, same guarantee as every other settings read on this screen.
   */
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(
    DEFAULT_DELIVERY_SETTINGS,
  );
  useEffect(() => {
    let cancelled = false;
    void loadDeliverySettings().then((settings) => {
      if (!cancelled) setDeliverySettings(settings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null);
  const [deliveryPin, setDeliveryPin] = useState<DeliveryMapPin | null>(null);
  const [deliveryPastedMapsUrl, setDeliveryPastedMapsUrl] = useState('');
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // The 27-key enum `delivery.ts` speaks, resolved from the free text the
  // rest of this screen still uses (#83 predates #163 and the two systems
  // are not unified here).
  const governorateKey = resolveGovernorateKey(governorate ?? null);
  const availableMethods = availableDeliveryMethods(deliverySettings, governorateKey);

  /**
   * The owner's one exception: Standard MAY be auto-selected when it is the
   * only method offered. Every other case requires an explicit choice, so
   * a method this effect set itself is un-set the moment Same-day becomes
   * offered too — a governorate typed after Standard was auto-picked must
   * not leave that pick standing in for a choice the shopper never made.
   */
  const autoSelectedStandard = useRef(false);
  useEffect(() => {
    if (availableMethods.standardOnly) {
      setDeliveryMethod('STANDARD');
      autoSelectedStandard.current = true;
    } else if (autoSelectedStandard.current) {
      setDeliveryMethod(null);
      autoSelectedStandard.current = false;
    }
  }, [availableMethods.standardOnly, governorateKey]);

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

  const subtotalMinor = subtotalToMinor(subtotalAmount);
  const summary = shippingSummary({
    effective,
    subtotalMinor,
    discountMinor,
    governorate,
  });
  const goodsMinor = Math.max(0, subtotalMinor - discountMinor);
  // SAME_DAY charges goods only through checkout — the delivery fee is
  // confirmed after the order and paid in cash on delivery, never added to
  // the total here (frontend#163).
  const sameDaySelected = deliveryMethod === 'SAME_DAY';
  const totalMinor = totalMinorForDelivery(deliveryMethod, goodsMinor, summary.totalMinor);

  /**
   * DECISION 4 of #83, surfaced where the issue asks for it.
   *
   * `codMaxOrderMinor` gates the TOTAL, and the total now moves with the
   * governorate — so the same bag can allow cash on delivery in one place and
   * not in another. Saying so here, beside the field that causes it, is the
   * whole point: the alternative is a shopper filling in every detail and being
   * refused at the payment step by a number they were never shown.
   *
   * Only claimed once the fee is FIRM. While the summary still reads "from",
   * the total is a floor and a floor cannot tell you that a ceiling is
   * breached.
   */
  // `null` = no COD limit set, the default (minirue-backend#105).
  const codBlocked = !summary.fromOnly && codMaxMinor !== null && totalMinor > codMaxMinor;

  const hasRateTable = effective.rates.length > 0;
  const money = (minor: number) => `${minorToAmount(minor)} ${currency}`;

  /**
   * The line under the governorate field: what this choice costs, in words,
   * where the shopper is looking when they make it.
   *
   * Deliberately the SAME numbers the summary card draws — read from one
   * `shippingSummary` call rather than recomputed — because a field that says
   * EGP 60 beside a card that says EGP 100 is the drift this whole feature is
   * meant to prevent, reproduced inside one screen.
   */
  const governorateHint = !hasRateTable ? undefined : summary.free
    ? 'Delivery is free on this order, wherever it goes.'
    : summary.fromOnly
      ? `Delivery from ${money(effective.minFeeCents)} — choose your governorate for the exact fee.`
      : summary.resolved?.status === 'NO_MATCH'
        ? `Not in our delivery list, so the standard rate of ${money(summary.feeMinor)} applies. Pick the closest match to see its own fee.`
        : `Delivery to ${summary.resolved?.label ?? 'this address'} · ${money(summary.feeMinor)}`;

  return (
    <CheckoutShell>
      <CheckoutPageFrame
        step={2}
        eyebrow="Step 2 of 4"
        title="Delivery"
        subtitle="Choose where we should send your order. You can manage saved addresses in your account."
        maxWidth={720}
        // Cart ref is gone from the summary (#102): an internal id means
        // nothing to a shopper. `cartId` still goes to analytics below.
        aside={
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
              {/*
                The row this whole issue is about. It used to read
                `SHIPPING_AMOUNT_MINOR` — a constant that said EGP 50 while the
                shop charged EGP 100 — and it now follows the governorate the
                shopper picks, through the same `shippingSummary` the bag uses.
              */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--mr-sp-3)' }}
                data-trace-id="PG-STOREFRONT-CHK-002::EL-ROW-shipping"
              >
                <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
                  Shipping
                  {!sameDaySelected && summary.resolved?.label && (
                    <span style={{ color: 'var(--mr-fg-4)' }}> · {summary.resolved.label}</span>
                  )}
                </span>
                {sameDaySelected ? (
                  // The owner's binding decision: never "0 EGP" with no
                  // explanation. The fee is confirmed after the order and
                  // paid in cash on delivery, so the total above never
                  // includes it either.
                  <span
                    style={{
                      fontFamily: 'var(--mr-font-ui)',
                      fontSize: 'var(--mr-text-sm)',
                      color: 'var(--mr-fg-4)',
                      fontStyle: 'italic',
                      textAlign: 'right',
                    }}
                  >
                    {SAME_DAY_SHIPPING_LABEL}
                  </span>
                ) : summary.free ? (
                  // "Free", not "EGP 0" — the product page promises
                  // complimentary delivery in words, and the summary has to
                  // keep that promise in the same language or it reads as the
                  // threshold having failed to apply.
                  <span
                    style={{
                      fontFamily: 'var(--mr-font-ui)',
                      fontSize: 'var(--mr-text-sm)',
                      color: 'var(--mr-fg-4)',
                      fontStyle: 'italic',
                    }}
                  >
                    Free
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                    {summary.fromOnly && (
                      <span
                        style={{
                          fontFamily: 'var(--mr-font-ui)',
                          fontSize: 'var(--mr-text-xs)',
                          color: 'var(--mr-fg-4)',
                        }}
                      >
                        from
                      </span>
                    )}
                    <PriceDisplay amount={minorToAmount(summary.feeMinor)} currency={currency} />
                  </span>
                )}
              </div>
              {/*
                The discount the bag already showed. Its absence here was half
                the reason the two screens disagreed.
              */}
              {discountMinor > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--mr-sp-3)' }}>
                  <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
                    {automatic?.code ?? 'Discount'}
                  </span>
                  <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-2)' }}>
                    −
                    <PriceDisplay
                      amount={minorToAmount(discountMinor)}
                      currency={currency}
                      style={{
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        color: 'inherit',
                        fontWeight: 'inherit',
                      }}
                    />
                  </span>
                </div>
              )}
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
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                  {/*
                    A total that can still move is labelled as one. Until a
                    governorate is chosen this figure is built on `minFeeCents`,
                    so it is a FLOOR — and a floor presented as a price is the
                    bait the "from" exists to prevent.
                  */}
                  {!sameDaySelected && summary.fromOnly && (
                    <span
                      style={{
                        fontFamily: 'var(--mr-font-ui)',
                        fontSize: 'var(--mr-text-xs)',
                        color: 'var(--mr-fg-4)',
                      }}
                    >
                      from
                    </span>
                  )}
                  <PriceDisplay
                    amount={minorToAmount(totalMinor)}
                    currency={currency}
                    style={{ fontSize: 'var(--mr-text-lg)', color: 'var(--mr-fg)' }}
                  />
                </span>
              </div>
            </div>
          </CheckoutSummaryCard>
        }
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
                      setGuestErrors(validateGuest(next, hasRateTable));
                    }
                  }}
                  errors={guestErrors}
                  mobile={mobile}
                  governorateHint={governorateHint}
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
                      {/*
                        The governorate is shown on a saved address now because
                        it decides the price. It was omitted while every address
                        cost the same to reach; leaving it out once it does not
                        would hide the reason one saved address is more
                        expensive than another.
                      */}
                      {addr.governorate ? ` · ${addr.governorate}` : ''}
                      {addr.postalCode ? ` · ${addr.postalCode}` : ''}
                    </>
                  }
                  badge={addr.isDefault ? 'Default' : undefined}
                />
                ))}
            </div>

            {/*
              A saved address gets NO select.

              The server resolves the fee from the free text stored ON the
              address, so a picker here that disagreed with it would show one
              number and charge another — which is the exact defect #83 exists
              to remove, rebuilt in the name of fixing it. What the shopper gets
              instead is the resolution stated plainly, and a link to the one
              place that can actually change it.
            */}
            {signedIn === true && hasRateTable && selectedAddress && (
              <>
                {summary.resolved?.status === 'NO_MATCH' && (
                  <CheckoutAlert variant="info">
                    We could not match <strong>{selectedAddress.governorate}</strong> to one
                    of our delivery areas, so this order ships at the standard rate of{' '}
                    {money(summary.feeMinor)}. Your order is not affected. To be charged a
                    governorate rate instead, update the address in{' '}
                    <Link href="/account/addresses" style={{ color: 'inherit', fontWeight: 600 }}>
                      your account
                    </Link>
                    .
                  </CheckoutAlert>
                )}
                {summary.resolved?.status === 'NO_GOVERNORATE' && (
                  <CheckoutAlert variant="info">
                    This address has no governorate on it, so it ships at the standard rate
                    of {money(summary.feeMinor)}. Adding one in{' '}
                    <Link href="/account/addresses" style={{ color: 'inherit', fontWeight: 600 }}>
                      your account
                    </Link>{' '}
                    may change the delivery fee.
                  </CheckoutAlert>
                )}
              </>
            )}

            {/*
              #158/#163: the CLOSED-ENUM concern, separate from #83's rate-table
              one above. A saved address can match a shipping rate row (or have
              none configured at all) and still carry free text that is not one
              of the 27 governorate keys — which blocks same-day eligibility and
              was the exact shape of a live incident (garbage text reaching
              checkout). Fixed in place, not just linked away to /account.
            */}
            {signedIn === true && selectedAddress && !resolveGovernorateKey(selectedAddress.governorate) && (
              <CheckoutAlert variant="warning">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-2)' }}>
                  <span>
                    This address&apos;s governorate (&ldquo;{selectedAddress.governorate || '—'}
                    &rdquo;) isn&apos;t one of our delivery areas. Choose it below to continue.
                  </span>
                  <GovernorateKeySelect
                    label="Choose your governorate"
                    value=""
                    onChange={async (key) => {
                      setFixGovernorateError(null);
                      try {
                        await updateAddress.mutateAsync({
                          id: selectedAddress.id,
                          input: { governorate: key },
                        });
                      } catch {
                        setFixGovernorateError('Could not update this address. Please try again.');
                      }
                    }}
                    error={fixGovernorateError ?? undefined}
                  />
                </div>
              </CheckoutAlert>
            )}

            {/*
              DECISION 4 of #83. Raised HERE, at the address step, and not as a
              payment failure after the shopper has filled everything in.
            */}
            {codBlocked && (
              <CheckoutAlert variant="warning">
                {summary.resolved?.label
                  ? `Delivery to ${summary.resolved.label} brings this order to ${money(totalMinor)}`
                  : `This order comes to ${money(totalMinor)}`}
                , above the {money(codMaxMinor ?? 0)} limit for cash on delivery. You can pay by
                Instapay on the next step — or choose a governorate with a lower delivery
                fee, if one applies to you.
              </CheckoutAlert>
            )}
          </CheckoutSection>

          {/*
            Standard / Same-day (frontend#163), tied to the governorate above.
            The customer must explicitly choose before purchase — the one
            exception is `standardOnly`, where Standard auto-selects with a
            one-line note, per the owner's binding decision.
          */}
          <CheckoutSection title="Delivery method">
            <DeliveryMethodStep
              settings={deliverySettings}
              available={availableMethods}
              method={deliveryMethod}
              onMethodChange={(next) => {
                setDeliveryMethod(next);
                autoSelectedStandard.current = false;
                setDeliveryError(null);
              }}
              standardFeeLabel={
                summary.free ? 'Free' : summary.fromOnly ? `from ${money(summary.feeMinor)}` : money(summary.feeMinor)
              }
              pin={deliveryPin}
              onPinChange={(pin) => {
                setDeliveryPin(pin);
                setDeliveryError(null);
              }}
              pastedMapsUrl={deliveryPastedMapsUrl}
              onPastedMapsUrlChange={(url) => {
                setDeliveryPastedMapsUrl(url);
                setDeliveryError(null);
              }}
            />
            {/*
              Shown for BOTH failure modes — no method chosen at all, and
              SAME_DAY with nothing usable yet — because the first can happen
              before the Same-day card's own location block ever renders.
            */}
            {deliveryError && <CheckoutAlert variant="error">{deliveryError}</CheckoutAlert>}
          </CheckoutSection>

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
            // Standard / Same-day (frontend#163). Checked before either
            // branch below: the customer must explicitly choose before
            // purchase, and SAME_DAY must carry a usable location — blocked
            // here with an inline message, never sent as a silent gap.
            const resolvedLocation = resolveDeliveryLocation(deliveryPin, deliveryPastedMapsUrl);
            if (!deliveryMethod) {
              setDeliveryError('Choose a delivery method before continuing.');
              return;
            }
            if (deliveryMethod === 'SAME_DAY' && !resolvedLocation) {
              setDeliveryError(
                'Add your delivery location — drop a pin, use your location, or paste a Google Maps link.',
              );
              return;
            }
            setDeliveryError(null);
            const deliveryFields =
              deliveryMethod === 'SAME_DAY'
                ? { deliveryMethod, deliveryLocation: resolvedLocation ?? undefined }
                : { deliveryMethod, deliveryLocation: undefined };

            if (signedIn === false) {
              const errors = validateGuest(guest, hasRateTable);
              if (Object.keys(errors).length) {
                setGuestErrors(errors);
                // Send focus to the first problem rather than leaving the
                // shopper to hunt for it below the fold on a phone.
                const first = Object.keys(errors)[0];
                document.getElementById(first)?.focus();
                return;
              }
              setGuestErrors({});
              saveCheckoutSession({
                guest,
                shippingAddressId: undefined,
                // The text, not the resolved key — see checkout-session.ts.
                shippingGovernorate: guest.governorate,
                ...deliveryFields,
              });
              track('checkout_address_entered', { cartId, hasAddress: true });
              // The resolved governorate key and match status are deliberately
              // NOT sent with this event. `checkout_shipping_selected` is typed
              // `{ method, cartId }` in lib/analytics, which this change does
              // not own, and widening a shared analytics contract belongs in
              // its own PR. Worth doing: a rate table whose rows nobody ever
              // matches is invisible today except as an unexplained run of
              // standard-rate orders — which is the #83 defect, in the data.
              track('checkout_shipping_selected', { method: 'STANDARD', cartId });
              router.push('/checkout/payment');
              return;
            }

            if (!selectedId) return;
            saveCheckoutSession({
              shippingAddressId: selectedId,
              guest: undefined,
              shippingGovernorate: selectedAddress?.governorate,
              ...deliveryFields,
            });
            track('checkout_address_entered', { cartId, hasAddress: true });
            // One shipping METHOD, still — there is no express option and no
            // separate picker screen, so "selected" is recorded here, the
            // moment the shopper commits to the step that carries it. What has
            // changed is that the method no longer implies the price (#83).
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

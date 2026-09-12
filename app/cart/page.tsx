'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/storefront/cart/CartContext';
import CartItemRow from '@/components/storefront/cart/CartItemRow';
import { toPricingLines, type BagLine } from '@/components/storefront/cart/bag-lines';
import PriceDisplay from '@/components/storefront/PriceDisplay';
import CheckoutShell from '@/components/checkout/CheckoutShell';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import { CheckoutAlert } from '@/components/checkout/checkout-ui';
import Button from '@/components/ui/Button';
import Toast from '@/components/ui/Toast';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { shippingMinorFor } from '@/lib/checkout/checkout-money';
import {
  useAutomaticDiscount,
  useShippingPolicy,
} from '@/components/storefront/cart/use-bag-pricing';
import DiscountCodeField from '@/components/checkout/DiscountCodeField';
import { loadAppliedCode, type DiscountPreview } from '@/lib/api/discounts';

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function CartPage() {
  const router = useRouter();
  const { mobile } = useBreakpoint();
  const { lines, bundleIndex, subtotalAmount, currency, itemCount, loading, error, setLineQty, removeLine, clearError } =
    useCart();
  const [toast, setToast] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);

  const [discount, setDiscount] = React.useState<DiscountPreview | null>(null);

  /**
   * Whether a typed code owns the summary — and, until the saved one has been
   * re-checked, whether we know.
   *
   * `DiscountCodeField` re-previews any code kept in localStorage on mount, so
   * `discount === null` on the first render means "not yet" as often as it
   * means "none". Firing the automatic preview into that ambiguity spends one
   * of ten requests per ten minutes to learn something the coded preview is
   * about to tell us anyway: `priceBag` returns `max(code, automatic)`, so an
   * applied code's `discountMinor` already includes the markdown.
   *
   * Resolved in an effect rather than in the initial state so the server render
   * and the first client render agree — localStorage does not exist during SSR.
   */
  const [codeStatus, setCodeStatus] = React.useState<
    'unknown' | 'none' | 'applied'
  >('unknown');

  React.useEffect(() => {
    setCodeStatus(loadAppliedCode() ? 'unknown' : 'none');
  }, []);

  const handleDiscountChange = React.useCallback(
    (preview: DiscountPreview | null) => {
      setDiscount(preview);
      setCodeStatus(preview ? 'applied' : 'none');
    },
    [],
  );

  /**
   * The bag, in the shape the discount endpoint wants.
   *
   * Prices come from the cart's own line data rather than being looked up
   * again, so the figure the shopper sees is derived from the same numbers the
   * rest of this summary uses. The server recomputes all of it at Place order
   * regardless — this is display only.
   *
   * It goes through `toPricingLines` so the bundle markers travel with it.
   * This used to map `items` to `{variantId, qty, unitPriceMinor}` and drop
   * `bundleId`/`bundleLineKey` on the floor — so every member of a set arrived
   * at `priceBag()` looking like an ordinary line and was counted as
   * discountable, against the bundle page's own promise that "Discount codes
   * do not apply to sets". The preview offered a saving checkout would then
   * refuse to give.
   */
  const discountLines = React.useMemo(
    () => toPricingLines(lines, bundleIndex),
    [lines, bundleIndex],
  );

  /**
   * The sitewide markdown, priced by the server for THIS bag.
   *
   * #36: the product page struck EGP 799 through to EGP 719.10 and the bag
   * charged 799 with no discount row at all, because nothing here asked for the
   * automatic offer unless the shopper typed a code. The preview endpoint runs
   * the same `priceBag()` checkout runs and accepts a null code, so asking it
   * is the whole fix — and the figure is the server's, not a second copy of the
   * discount rules living in the browser.
   */
  const automatic = useAutomaticDiscount(
    discountLines,
    codeStatus === 'none' && lines.length > 0,
  );

  /**
   * The code wins when there is one, because the server already compared them.
   * A coded preview's `discountMinor` is `max(code, automatic)` with a
   * `winner` — adding the automatic on top would give the same saving twice.
   */
  const appliedDiscount = discount ?? automatic;

  const subtotalMinor = Math.round(parseFloat(subtotalAmount || '0') * 100);
  const discountMinor = appliedDiscount?.discountMinor ?? 0;

  /**
   * Delivery, from the shop's settings rather than from a constant.
   *
   * #38: this was `SHIPPING_AMOUNT_MINOR = 5_000`, described in its own comment
   * as mirroring the backend — which it did, until the backend made the value
   * an admin setting and the mirror had no way to notice.
   *
   * Judged on the subtotal BEFORE the discount, matching the backend's default
   * `freeShippingBasis`: a bag that earned free delivery does not lose it the
   * moment a code is applied.
   *
   * Caveat worth knowing while reading this: `GET /v1/settings/public` does not
   * expose `shipping` yet, so `loadShippingPolicy()` still falls back to 5 000
   * on the live backend. The plumbing is what changed — the figure follows the
   * dashboard the day the endpoint carries it.
   */
  const shippingPolicy = useShippingPolicy();
  const shippingMinor = shippingMinorFor(subtotalMinor, shippingPolicy);
  const shippingIsFree = shippingMinor === 0;

  // Floored, exactly as the server floors it. A summary that can show a
  // negative total is a summary nobody trusts again.
  /**
   * Subtotal − discount + shipping.
   *
   * Shipping was shown as its own row and then LEFT OUT of the total, so the
   * bag said EGP 180 and the very next screen said EGP 230 (owner,
   * 2026-08-21). A summary that contradicts the checkout it leads to is worse
   * than no summary: the shopper reads the smaller number as the price and
   * meets the real one at the point they are asked to pay.
   *
   * Still "estimated" because the server recomputes everything at Place order —
   * it is the authority, this is display.
   */
  const estimatedTotal = minorToAmount(
    Math.max(0, subtotalMinor - discountMinor) + shippingMinor,
  );

  // No auth gate. A guest has a cart — it is keyed by the mr-cart-session
  // cookie and the backend accepts it — so bouncing them here threw a shopper
  // at a sign-in form the moment they clicked the basket, before they had
  // decided to buy anything. Identity is asked for once, at checkout.
  React.useEffect(() => {
    setAuthChecked(true);
  }, []);

  const handleRemove = async (line: BagLine) => {
    // The label is read BEFORE the removal: once the line is gone it is gone
    // from `lines` too, and the toast would have nothing to name.
    const label = line.name;
    await removeLine(line);
    setToast(`${label} removed from your bag`);
  };

  if (!authChecked) {
    return null;
  }

  return (
    <CheckoutShell>
      <main
        data-screen-label="Storefront · Cart"
        style={{
          maxWidth: 'var(--mr-content-max)',
          margin: '0 auto',
          padding: mobile
            ? 'var(--mr-sp-6) var(--mr-gutter) var(--mr-sp-8)'
            : 'var(--mr-sp-7) var(--mr-gutter) var(--mr-sp-9)',
        }}
      >
        <CheckoutSteps current={1} />

        <p
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--mr-gold-500)',
            margin: '0 0 var(--mr-sp-3)',
          }}
        >
          Step 1 of 4
        </p>
        <h1
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontSize: mobile ? 'var(--mr-text-xl)' : 'var(--mr-text-2xl)',
            fontWeight: 400,
            color: 'var(--mr-fg)',
            marginBottom: 'var(--mr-sp-6)',
            letterSpacing: '-0.01em',
          }}
        >
          Your bag
          {itemCount > 0 && (
            <span
              style={{
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-sm)',
                color: 'var(--mr-fg-4)',
                marginLeft: 'var(--mr-sp-3)',
                fontWeight: 400,
              }}
            >
              ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </span>
          )}
        </h1>

        {error && (
          <CheckoutAlert variant="error" onDismiss={clearError}>
            {error}
          </CheckoutAlert>
        )}

        {lines.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--mr-sp-9) 0',
              animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) both',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontStyle: 'italic',
                fontSize: 'var(--mr-text-xl)',
                color: 'var(--mr-fg-2)',
                marginBottom: 'var(--mr-sp-5)',
              }}
            >
              Your bag is empty — the maison awaits.
            </p>
            <Button variant="primary" sweep onClick={() => router.push('/shop/all')}>
              Explore fragrances
            </Button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              /**
               * `minmax(0, 1fr)` on BOTH branches. The mobile one was a bare
               * `1fr`, and that is the whole bug.
               *
               * A bare `1fr` track is `minmax(auto, 1fr)`, and that `auto`
               * minimum refuses to shrink the track below its content's
               * min-content width. So the moment anything inside was wider than
               * the phone — a long product name, the discount input, the
               * summary card's own padding — the TRACK grew and the entire grid
               * spilled past the right edge, while the left stayed correctly
               * inset by the gutter. That is precisely the reported symptom:
               * "laid off to the right, cut out" on /cart, on mobile only
               * (owner, 2026-08-21, reported three times).
               *
               * The desktop branch already had it right, which is why this only
               * ever went wrong on a phone.
               *
               * Fixing it HERE and not with `overflow` is the point: this page
               * sits under `overflow-x: clip` (added for the chat button, which
               * hangs off the edge by design), so an overflowing track is not
               * scrolled, it is silently CUT. A layout that cannot overflow is
               * the only version of this that stays fixed.
               */
              gridTemplateColumns: mobile
                ? 'minmax(0, 1fr)'
                : 'minmax(0, 1fr) minmax(260px, 320px)',
              gap: mobile ? 'var(--mr-sp-6)' : 'var(--mr-sp-7)',
              alignItems: 'start',
            }}
          >
            <section
              aria-label="Cart items"
              style={{
                opacity: loading ? 0.7 : 1,
                transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
              }}
            >
              {!mobile && (
                <div
                  aria-hidden
                  style={{
                    display: 'grid',
                    // minmax(0, …), not a bare 1fr — same reason as the outer
                    // grid above: a bare track will not shrink below its
                    // content and pushes the row past the container.
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    paddingBottom: 'var(--mr-sp-3)',
                    borderBottom: '1px solid var(--mr-hairline)',
                  }}
                >
                  <span style={tableHeaderStyle}>Product</span>
                  <span style={tableHeaderStyle}>Total</span>
                </div>
              )}

              {lines.map((line) => (
                <CartItemRow
                  key={line.key}
                  line={line}
                  onUpdateQty={setLineQty}
                  onRemove={handleRemove}
                />
              ))}

              <div style={{ marginTop: 'var(--mr-sp-5)' }}>
                <Link href="/shop/all" style={continueLinkStyle}>
                  ← Continue shopping
                </Link>
              </div>
            </section>

            <aside
              aria-label="Order summary"
              style={{
                background: 'var(--mr-cream-100)',
                borderRadius: 'var(--mr-radius-lg)',
                padding: 'var(--mr-sp-6)',
                boxShadow: 'var(--mr-shadow-sm)',
                border: '1px solid var(--mr-hairline)',
                position: mobile ? 'static' : 'sticky',
                top: 96,
              }}
            >
              <h2 style={summaryTitleStyle}>Order summary</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
                <SummaryRow
                  label="Subtotal"
                  value={<PriceDisplay amount={subtotalAmount} currency={currency} />}
                />
                {/*
                  PriceDisplay, not `{amount} {currency}`.

                  Subtotal and Estimated total go through it; Shipping and the
                  discount row were interpolating raw, so one summary block
                  showed `EGP 799` on two rows and `50.00 EGP` on the others —
                  the symbol changing sides and the decimals appearing and
                  disappearing between lines a shopper reads in one glance.

                  formatMoney already owns this: prefix, grouping, and no
                  trailing `.00` on a whole amount. The styling that made this
                  row quiet is kept as a `style` override rather than as a
                  reason to re-spell the price.
                */}
                <SummaryRow
                  label="Shipping"
                  value={
                    shippingIsFree ? (
                      /*
                        A zero here is the free-delivery threshold being met, and
                        "EGP 0" is a worse way to say so than the word. The PDP
                        already promises "Complimentary shipping over EGP 3,000";
                        the bag has to keep that promise in the same language, or
                        it reads as the threshold having failed to apply.
                      */
                      <span style={quietSummaryValueStyle}>Free</span>
                    ) : (
                      <PriceDisplay
                        amount={minorToAmount(shippingMinor)}
                        currency={currency}
                        style={quietSummaryValueStyle}
                      />
                    )
                  }
                />
                {discountMinor > 0 && (
                  <SummaryRow
                    label={appliedDiscount?.code ?? 'Discount'}
                    value={
                      <span
                        style={{
                          fontFamily: 'var(--mr-font-ui)',
                          fontSize: 'var(--mr-text-sm)',
                          color: 'var(--mr-fg-2)',
                        }}
                      >
                        {/*
                          The minus stays outside PriceDisplay: it is not part of
                          the amount, and formatMoney would otherwise be asked to
                          format a negative number and place the sign relative to
                          the currency prefix itself.
                        */}
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
                    }
                  />
                )}
                <div style={{ height: 1, background: 'var(--mr-hairline)', margin: 'var(--mr-sp-2) 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--mr-sp-3)', minWidth: 0 }}>
                  <span style={{ ...summaryTitleStyle, marginBottom: 0, fontSize: 'var(--mr-text-sm)' }}>
                    Estimated total
                  </span>
                  <PriceDisplay
                    amount={estimatedTotal}
                    currency={currency}
                    style={{ fontSize: 'var(--mr-text-lg)', color: 'var(--mr-fg)' }}
                  />
                </div>
              </div>

              {/* The owner's ask: somewhere in checkout to type the code the
                  dashboard generates. Here on the Bag step, and again on
                  Payment as a last chance before paying. */}
              {lines.length > 0 && (
                <div style={{ marginTop: 'var(--mr-sp-5)', paddingTop: 'var(--mr-sp-4)', borderTop: '1px solid var(--mr-hairline)' }}>
                  <DiscountCodeField lines={discountLines} onChange={handleDiscountChange} />
                </div>
              )}

              <div style={{ marginTop: 'var(--mr-sp-6)' }}>
                <Button variant="primary" sweep onClick={() => router.push('/checkout')} style={{ width: '100%' }}>
                  Proceed to checkout
                </Button>
              </div>

              <p
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-xs)',
                  color: 'var(--mr-fg-4)',
                  textAlign: 'center',
                  marginTop: 'var(--mr-sp-3)',
                  lineHeight: 1.5,
                }}
              >
                Taxes &amp; duties calculated at checkout.
              </p>
            </aside>
          </div>
        )}
      </main>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </CheckoutShell>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-4)',
};

const summaryTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg)',
  marginBottom: 'var(--mr-sp-5)',
};

/** The Shipping row's understatement, shared by the fee and by "Free". */
const quietSummaryValueStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-ui)',
  fontSize: 'var(--mr-text-sm)',
  color: 'var(--mr-fg-4)',
  fontStyle: 'italic',
};

const continueLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--mr-sp-2)',
};

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--mr-sp-3)',
      }}
    >
      <span style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
        {label}
      </span>
      {value}
    </div>
  );
}

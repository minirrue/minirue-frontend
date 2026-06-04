'use client';

/**
 * /checkout — multi-step checkout page.
 *
 * Step 1: Address (billing + shipping — same address toggle, saved addresses for
 *         logged-in users)
 * Step 2: Review order (cart items, subtotal, shipping placeholder, total)
 * Step 3: Payment method (COD first, card option)
 *
 * On submit: POST /v1/orders/checkout → redirect to /orders/:id/confirmation
 *
 * [TBD] Shipping cost calculation not available — shown as "Calculated at checkout".
 * [TBD] Card payment integration not specified — card option is a UI stub.
 * [TBD] Checkout request body shape inferred from cart + address + payment;
 *       confirm field names with backend.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import { useCart } from '@/components/storefront/cart/CartContext';
import PriceDisplay from '@/components/storefront/PriceDisplay';
import { apiGetAddresses, type Address, type AddressInput } from '@/lib/api/customers';
import { apiFetch, type ApiError } from '@/lib/api/client';
import { apiInitiatePayment } from '@/lib/api/payments';
import type {} from '@/lib/api/cart';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type PaymentMethod = 'COD' | 'CARD';

interface CheckoutPayload {
  cartId: string;
  shippingAddressId: string;
}

interface CheckoutResponse {
  id: string;
  orderNumber: string;
}

// ── Styles (shared) ───────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelTextStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-4)',
};
const inputStyle: React.CSSProperties = {
  border: '1px solid var(--mr-border)',
  borderRadius: 'var(--mr-radius-sm)',
  padding: '9px 12px',
  fontSize: 'var(--mr-text-sm)',
  fontFamily: 'var(--mr-font-ui)',
  color: 'var(--mr-fg)',
  background: 'var(--mr-bg-raised)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color var(--mr-dur-fast) var(--mr-ease-out)',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '13px 32px',
  background: 'var(--mr-ink-900)',
  color: 'var(--mr-cream-100)',
  border: 'none',
  borderRadius: 'var(--mr-radius-pill)',
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: 'var(--mr-shadow-sm)',
  transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
};

const ghostBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--mr-border)',
  borderRadius: 'var(--mr-radius-sm)',
  padding: '10px 20px',
  fontSize: 'var(--mr-text-xs)',
  fontFamily: 'var(--mr-font-label)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
  cursor: 'pointer',
};

// ── Blank address form ────────────────────────────────────────────────────────

const BLANK_ADDRESS: AddressInput = {
  label: 'HOME',
  line1: '',
  line2: '',
  city: '',
  governorate: '',
  postalCode: '',
  countryCode: 'EG',
  isDefault: false,
};

// ── Address form sub-component ────────────────────────────────────────────────

function AddressForm({
  title,
  value,
  onChange,
}: {
  title: string;
  value: AddressInput;
  onChange: (v: AddressInput) => void;
}) {
  const field =
    (key: keyof AddressInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [key]: e.target.value });

  return (
    <fieldset
      style={{
        border: '1px solid var(--mr-border)',
        borderRadius: 'var(--mr-radius-md)',
        padding: '20px 24px',
        background: 'var(--mr-bg-raised)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        margin: 0,
      }}
    >
      <legend
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-3)',
          padding: '0 6px',
        }}
      >
        {title}
      </legend>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Address Line 1</span>
        <input
          type="text"
          value={value.line1}
          onChange={field('line1')}
          required
          autoComplete="address-line1"
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Address Line 2 (optional)</span>
        <input
          type="text"
          value={value.line2 ?? ''}
          onChange={field('line2')}
          autoComplete="address-line2"
          style={inputStyle}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>City</span>
          <input
            type="text"
            value={value.city}
            onChange={field('city')}
            required
            autoComplete="address-level2"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Governorate</span>
          <input
            type="text"
            value={value.governorate}
            onChange={field('governorate')}
            required
            autoComplete="address-level1"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Postal Code</span>
          <input
            type="text"
            value={value.postalCode ?? ''}
            onChange={field('postalCode')}
            autoComplete="postal-code"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Country</span>
          <input
            type="text"
            value={value.countryCode ?? ''}
            onChange={field('countryCode')}
            required
            maxLength={2}
            placeholder="EG"
            autoComplete="country"
            style={inputStyle}
          />
        </label>
      </div>
    </fieldset>
  );
}

// ── Saved address card ────────────────────────────────────────────────────────

function SavedAddressCard({
  address,
  selected,
  onSelect,
}: {
  address: Address;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        border: selected ? '1.5px solid var(--mr-accent)' : '1px solid var(--mr-border)',
        borderRadius: 'var(--mr-radius-md)',
        padding: '14px 18px',
        background: selected ? 'rgba(149,120,60,0.05)' : 'var(--mr-bg-raised)',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        transition:
          'border-color var(--mr-dur-fast) var(--mr-ease-out), background var(--mr-dur-fast) var(--mr-ease-out)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Radio dot */}
      <div
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: selected ? '5px solid var(--mr-accent)' : '1.5px solid var(--mr-border)',
          flexShrink: 0,
          marginTop: 2,
          background: 'var(--mr-bg-raised)',
          transition: 'border var(--mr-dur-fast) var(--mr-ease-out)',
        }}
      />
      <div style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 500, color: 'var(--mr-fg)' }}>{address.label}</div>
        <div style={{ color: 'var(--mr-fg-3)' }}>{address.line1}</div>
        {address.line2 && <div style={{ color: 'var(--mr-fg-3)' }}>{address.line2}</div>}
        <div style={{ color: 'var(--mr-fg-3)' }}>
          {address.city}, {address.governorate}
          {address.postalCode ? ` ${address.postalCode}` : ''}
        </div>
        <div style={{ color: 'var(--mr-fg-4)', fontSize: 'var(--mr-text-xs)' }}>{address.countryCode}</div>
      </div>
    </button>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: 'Address' },
    { n: 2, label: 'Review' },
    { n: 3, label: 'Payment' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: 'var(--mr-sp-7)',
      }}
    >
      {steps.map(({ n, label }, idx) => {
        const done = step > n;
        const active = step === n;
        return (
          <React.Fragment key={n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: done
                    ? 'var(--mr-success)'
                    : active
                    ? 'var(--mr-ink-900)'
                    : 'var(--mr-cream-300)',
                  color: done || active ? 'var(--mr-cream-100)' : 'var(--mr-fg-4)',
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background var(--mr-dur-medium) var(--mr-ease-out)',
                  flexShrink: 0,
                }}
              >
                {done ? '✓' : n}
              </div>
              <span
                style={{
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: active ? 'var(--mr-fg)' : 'var(--mr-fg-4)',
                  fontWeight: active ? 600 : 400,
                  transition: 'color var(--mr-dur-medium) var(--mr-ease-out)',
                }}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: step > n ? 'var(--mr-success)' : 'var(--mr-hairline)',
                  margin: '0 var(--mr-sp-3)',
                  transition: 'background var(--mr-dur-medium) var(--mr-ease-out)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { cartId, items, subtotalAmount, currency, itemCount, openDrawer } = useCart();

  // Step state
  const [step, setStep] = React.useState<Step>(1);

  // Address state
  const [savedAddresses, setSavedAddresses] = React.useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = React.useState(true);
  const [selectedShippingId, setSelectedShippingId] = React.useState<string | null>(null);
  const [selectedBillingId, setSelectedBillingId] = React.useState<string | null>(null);
  const [sameAsShipping, setSameAsShipping] = React.useState(true);
  const [shippingForm, setShippingForm] = React.useState<AddressInput>({ ...BLANK_ADDRESS });
  const [billingForm, setBillingForm] = React.useState<AddressInput>({ ...BLANK_ADDRESS });
  const [useNewShipping, setUseNewShipping] = React.useState(false);
  const [useNewBilling, setUseNewBilling] = React.useState(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('COD');

  // Submit state
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Load saved addresses on mount
  React.useEffect(() => {
    setLoadingAddresses(true);
    apiGetAddresses()
      .then((addrs) => {
        setSavedAddresses(addrs);
        // Pre-select defaults
        const defAddr = addrs.find((a) => a.isDefault);
        const firstId = addrs.length > 0 ? addrs[0].id : null;
        setSelectedShippingId(defAddr?.id ?? firstId);
        setSelectedBillingId(defAddr?.id ?? firstId);
        if (addrs.length === 0) {
          setUseNewShipping(true);
          setUseNewBilling(true);
        }
      })
      .catch(() => {
        // Not logged in or no addresses — fall through to new address form
        setUseNewShipping(true);
        setUseNewBilling(true);
      })
      .finally(() => setLoadingAddresses(false));
  }, []);

  const hasSaved = savedAddresses.length > 0;

  // ── Step 1 submit ────────────────────────────────────────────────────────────

  function handleAddressNext(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  // ── Step 3 submit (place order) ──────────────────────────────────────────────

  async function handlePlaceOrder() {
    setSubmitting(true);
    setSubmitError(null);

    const shippingId = selectedShippingId;
    if (!shippingId) {
      setSubmitError('Please select a shipping address before placing your order.');
      setSubmitting(false);
      setStep(1);
      return;
    }

    const payload: CheckoutPayload = {
      cartId,
      shippingAddressId: shippingId,
    };

    try {
      const result = await apiFetch<CheckoutResponse>('/orders/checkout', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(payload),
      });
      // Initiate COD payment — auto-confirms order
      if (paymentMethod === 'COD') {
        await apiInitiatePayment(result.id, 'COD', crypto.randomUUID());
      }
      router.push(`/orders/${result.id}/confirmation`);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setSubmitError(apiErr.message ?? 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const totalAmount = subtotalAmount;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <Header onOpenCart={openDrawer} cartCount={itemCount} />

        <main
          style={{
            maxWidth: 'var(--mr-content-max)',
            margin: '0 auto',
            padding: 'var(--mr-sp-7) var(--mr-gutter)',
          }}
        >
          {/* Page title */}
          <h1
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontSize: 'var(--mr-text-2xl)',
              fontWeight: 400,
              color: 'var(--mr-fg)',
              marginBottom: 'var(--mr-sp-5)',
              letterSpacing: '-0.01em',
            }}
          >
            Checkout
          </h1>

          <StepBar step={step} />

          {/* Empty cart guard */}
          {items.length === 0 && (
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
                  marginBottom: 'var(--mr-sp-4)',
                }}
              >
                Your cart is empty.
              </p>
              <Link
                href="/products"
                style={{
                  display: 'inline-block',
                  padding: '12px 32px',
                  background: 'var(--mr-ink-900)',
                  color: 'var(--mr-cream-100)',
                  textDecoration: 'none',
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--mr-radius-pill)',
                }}
              >
                Continue Shopping
              </Link>
            </div>
          )}

          {items.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 340px',
                gap: 'var(--mr-sp-7)',
                alignItems: 'start',
              }}
            >
              {/* ── Left: step content ─────────────────────────────── */}
              <div>
                {/* ── Step 1: Address ─── */}
                {step === 1 && (
                  <form onSubmit={handleAddressNext}>
                    <SectionHeading>Shipping Address</SectionHeading>

                    {loadingAddresses && (
                      <p style={{ color: 'var(--mr-fg-4)', fontSize: 'var(--mr-text-sm)' }}>
                        Loading saved addresses…
                      </p>
                    )}

                    {!loadingAddresses && hasSaved && !useNewShipping && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                          {savedAddresses.map((addr) => (
                            <SavedAddressCard
                              key={addr.id}
                              address={addr}
                              selected={selectedShippingId === addr.id}
                              onSelect={() => setSelectedShippingId(addr.id)}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setUseNewShipping(true)}
                          style={ghostBtnStyle}
                        >
                          + Use a different address
                        </button>
                      </>
                    )}

                    {(!hasSaved || useNewShipping) && (
                      <>
                        <AddressForm
                          title="New Shipping Address"
                          value={shippingForm}
                          onChange={setShippingForm}
                        />
                        {hasSaved && (
                          <button
                            type="button"
                            onClick={() => setUseNewShipping(false)}
                            style={{ ...ghostBtnStyle, marginTop: 12 }}
                          >
                            ← Use saved address
                          </button>
                        )}
                      </>
                    )}

                    {/* Same as shipping toggle */}
                    <div style={{ marginTop: 'var(--mr-sp-5)', marginBottom: 'var(--mr-sp-4)' }}>
                      <label
                        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={sameAsShipping}
                          onChange={(e) => setSameAsShipping(e.target.checked)}
                          style={{ accentColor: 'var(--mr-accent)', width: 16, height: 16 }}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--mr-font-ui)',
                            fontSize: 'var(--mr-text-sm)',
                            color: 'var(--mr-fg-2)',
                          }}
                        >
                          Billing address same as shipping
                        </span>
                      </label>
                    </div>

                    {/* Billing address — shown only when not same as shipping */}
                    {!sameAsShipping && (
                      <>
                        <SectionHeading>Billing Address</SectionHeading>

                        {!loadingAddresses && hasSaved && !useNewBilling && (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                              {savedAddresses.map((addr) => (
                                <SavedAddressCard
                                  key={addr.id}
                                  address={addr}
                                  selected={selectedBillingId === addr.id}
                                  onSelect={() => setSelectedBillingId(addr.id)}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setUseNewBilling(true)}
                              style={ghostBtnStyle}
                            >
                              + Use a different address
                            </button>
                          </>
                        )}

                        {(!hasSaved || useNewBilling) && (
                          <>
                            <AddressForm
                              title="New Billing Address"
                              value={billingForm}
                              onChange={setBillingForm}
                            />
                            {hasSaved && (
                              <button
                                type="button"
                                onClick={() => setUseNewBilling(false)}
                                style={{ ...ghostBtnStyle, marginTop: 12 }}
                              >
                                ← Use saved address
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}

                    <div style={{ marginTop: 'var(--mr-sp-6)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" style={primaryBtnStyle}>
                        Continue to Review <span style={{ marginLeft: 6 }}>→</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* ── Step 2: Review ─── */}
                {step === 2 && (
                  <div>
                    <SectionHeading>Order Review</SectionHeading>

                    <div
                      style={{
                        border: '1px solid var(--mr-border)',
                        borderRadius: 'var(--mr-radius-md)',
                        overflow: 'hidden',
                        marginBottom: 'var(--mr-sp-5)',
                      }}
                    >
                      {items.map((item, idx) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 'var(--mr-sp-4)',
                            padding: '14px 18px',
                            borderBottom:
                              idx < items.length - 1 ? '1px solid var(--mr-hairline)' : 'none',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 500,
                                fontSize: 'var(--mr-text-sm)',
                                color: 'var(--mr-fg)',
                                fontFamily: 'var(--mr-font-ui)',
                              }}
                            >
                              {item.name ?? `Variant #${item.variantId}`}
                            </div>
                            {(item.brand || item.sizeMl) && (
                              <div
                                style={{
                                  fontSize: 'var(--mr-text-xs)',
                                  color: 'var(--mr-fg-4)',
                                  fontFamily: 'var(--mr-font-ui)',
                                  marginTop: 2,
                                }}
                              >
                                {[item.brand, item.sizeMl ? `${item.sizeMl} ml` : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: 'var(--mr-text-xs)',
                                color: 'var(--mr-fg-4)',
                                fontFamily: 'var(--mr-font-ui)',
                                marginTop: 2,
                              }}
                            >
                              Qty: {item.qty}
                            </div>
                          </div>
                          <PriceDisplay
                            amount={item.lineTotalAmount}
                            currency={item.unitPriceCurrency}
                            style={{ fontSize: 'var(--mr-text-sm)' }}
                          />
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 'var(--mr-sp-6)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        style={ghostBtnStyle}
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        style={primaryBtnStyle}
                      >
                        Continue to Payment <span style={{ marginLeft: 6 }}>→</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Payment ─── */}
                {step === 3 && (
                  <div>
                    <SectionHeading>Payment Method</SectionHeading>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 'var(--mr-sp-6)' }}>
                      {/* COD option */}
                      <PaymentOption
                        id="cod"
                        selected={paymentMethod === 'COD'}
                        onSelect={() => setPaymentMethod('COD')}
                        label="Cash on Delivery"
                        description="Pay in cash when your order arrives."
                        badge="Recommended"
                      />

                      {/* Card option — [TBD] integration not yet specified */}
                      <PaymentOption
                        id="card"
                        selected={paymentMethod === 'CARD'}
                        onSelect={() => setPaymentMethod('CARD')}
                        label="Credit / Debit Card"
                        description="Secure card payment. [TBD — payment gateway not yet integrated]"
                        disabled
                      />
                    </div>

                    {submitError && (
                      <div
                        role="alert"
                        style={{
                          padding: 'var(--mr-sp-3) var(--mr-sp-5)',
                          background: 'var(--mr-st-danger-bg)',
                          color: 'var(--mr-st-danger-fg)',
                          borderRadius: 'var(--mr-radius-md)',
                          fontFamily: 'var(--mr-font-ui)',
                          fontSize: 'var(--mr-text-sm)',
                          marginBottom: 'var(--mr-sp-5)',
                        }}
                      >
                        {submitError}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        style={ghostBtnStyle}
                        disabled={submitting}
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePlaceOrder()}
                        disabled={submitting}
                        style={{
                          ...primaryBtnStyle,
                          opacity: submitting ? 0.6 : 1,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {submitting ? 'Placing Order…' : 'Place Order'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: order summary sidebar ──────────────────── */}
              <aside
                aria-label="Order summary"
                style={{
                  background: 'var(--mr-cream-100)',
                  borderRadius: 'var(--mr-radius-lg)',
                  padding: 'var(--mr-sp-6)',
                  boxShadow: 'var(--mr-shadow-sm)',
                  position: 'sticky',
                  top: 96,
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--mr-fg)',
                    margin: '0 0 var(--mr-sp-5)',
                  }}
                >
                  Order Summary
                </h2>

                {/* Item count */}
                <p
                  style={{
                    fontSize: 'var(--mr-text-xs)',
                    color: 'var(--mr-fg-4)',
                    fontFamily: 'var(--mr-font-ui)',
                    margin: '0 0 var(--mr-sp-4)',
                  }}
                >
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
                  <CheckoutSummaryRow
                    label="Subtotal"
                    value={<PriceDisplay amount={subtotalAmount} currency={currency} />}
                  />
                  <CheckoutSummaryRow
                    label="Shipping"
                    value={
                      <span
                        style={{
                          fontFamily: 'var(--mr-font-ui)',
                          fontSize: 'var(--mr-text-xs)',
                          color: 'var(--mr-fg-4)',
                          fontStyle: 'italic',
                        }}
                      >
                        Calculated at checkout
                        {/* [TBD — shipping module not yet built] */}
                      </span>
                    }
                  />
                  <div style={{ height: 1, background: 'var(--mr-hairline)', margin: 'var(--mr-sp-1) 0' }} />
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--mr-font-label)',
                        fontSize: 'var(--mr-text-sm)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--mr-fg)',
                        fontWeight: 600,
                      }}
                    >
                      Total
                    </span>
                    <PriceDisplay
                      amount={totalAmount}
                      currency={currency}
                      style={{ fontSize: 'var(--mr-text-lg)' }}
                    />
                  </div>
                </div>

                <p
                  style={{
                    fontFamily: 'var(--mr-font-ui)',
                    fontSize: 'var(--mr-text-xs)',
                    color: 'var(--mr-fg-4)',
                    marginTop: 'var(--mr-sp-4)',
                    lineHeight: 1.5,
                  }}
                >
                  Taxes &amp; duties may apply.
                </p>
              </aside>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}

// ── Small layout helpers ──────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--mr-font-label)',
        fontSize: 'var(--mr-text-sm)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--mr-fg)',
        fontWeight: 600,
        margin: '0 0 var(--mr-sp-4)',
      }}
    >
      {children}
    </h2>
  );
}

function CheckoutSummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--mr-sp-3)' }}>
      <span
        style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}
      >
        {label}
      </span>
      {value}
    </div>
  );
}

function PaymentOption({
  id,
  selected,
  onSelect,
  label,
  description,
  badge,
  disabled,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={!disabled ? onSelect : undefined}
      disabled={disabled}
      style={{
        border: selected ? '1.5px solid var(--mr-accent)' : '1px solid var(--mr-border)',
        borderRadius: 'var(--mr-radius-md)',
        padding: '16px 20px',
        background: selected ? 'rgba(149,120,60,0.05)' : 'var(--mr-bg-raised)',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
        opacity: disabled ? 0.45 : 1,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        transition:
          'border-color var(--mr-dur-fast) var(--mr-ease-out), background var(--mr-dur-fast) var(--mr-ease-out)',
      }}
    >
      {/* Radio dot */}
      <div
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: selected ? '5px solid var(--mr-accent)' : '1.5px solid var(--mr-border)',
          flexShrink: 0,
          marginTop: 2,
          background: 'var(--mr-bg-raised)',
          transition: 'border var(--mr-dur-fast) var(--mr-ease-out)',
        }}
      />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-sm)',
              fontWeight: 500,
              color: 'var(--mr-fg)',
            }}
          >
            {label}
          </span>
          {badge && (
            <span
              style={{
                fontSize: 'var(--mr-text-xs)',
                fontFamily: 'var(--mr-font-label)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--mr-success)',
                background: 'var(--mr-st-ok-bg)',
                padding: '1px 7px',
                borderRadius: 'var(--mr-radius-pill)',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-xs)',
            color: 'var(--mr-fg-4)',
            margin: '3px 0 0',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

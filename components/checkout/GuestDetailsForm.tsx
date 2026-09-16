'use client';

import React from 'react';
import type { GuestCheckoutDetails } from '@/lib/checkout/checkout-session';
import GovernorateKeySelect from '@/components/checkout/GovernorateKeySelect';
import { resolveGovernorateKey } from '@/lib/checkout/governorates';

/**
 * Who a guest is, and where their order goes.
 *
 * Checkout used to demand a signed-in customer and one of their SAVED
 * addresses, so a guest who had filled a bag met a sign-in wall at the till
 * (owner, 2026-08-21). This is the replacement: the same details, typed once,
 * kept on the ORDER rather than in an account. Nothing here creates a user.
 *
 * WHY EACH FIELD IS HERE, since asking a stranger for their details is a cost
 * paid in abandoned carts and every one has to earn its place:
 *
 *   name, address  — the parcel cannot be delivered without them.
 *   phone          — the courier calls before arriving; this is Egypt, and an
 *                    address without a phone is a failed delivery.
 *   email          — the only channel a guest order confirmation can go down.
 *                    A signed-in shopper has one on file; a guest does not,
 *                    and without it they have no record of what they bought.
 *
 * There is deliberately nothing else. No account checkbox, no marketing
 * consent, no "create a password" — every extra field here is a reason to
 * leave, and the shop can ask later.
 */

export const EMPTY_GUEST: GuestCheckoutDetails = {
  fullName: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  governorate: '',
  postalCode: '',
};

export type GuestFieldErrors = Partial<Record<keyof GuestCheckoutDetails, string>>;

/**
 * Mirrors the server's zod schema (GuestCheckoutContactSchema /
 * GuestShippingAddressSchema in the backend's order.dto.ts).
 *
 * Duplicated on purpose, not shared: the server validates because it must not
 * trust a client, and the client validates so a shopper learns their phone
 * number is short BEFORE watching a request fail. Keep the two in step — if
 * they drift, the client is the one that is wrong.
 */
export function validateGuest(
  v: GuestCheckoutDetails,
  /**
   * Kept for callers still passing it — no longer changes anything here.
   * Before frontend#158 this decided the governorate error's WORDING
   * ("select" vs. "enter") depending on whether the shop published a rate
   * table. Free text is gone now regardless of that table: the governorate
   * is always one of the 27 closed keys, so there is exactly one error and
   * one wording.
   * @deprecated no longer read; retained for call-site compatibility only.
   */
  _hasRateTable = false,
): GuestFieldErrors {
  const errors: GuestFieldErrors = {};
  const digits = (v.phone.match(/\d/g) ?? []).length;

  if (v.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
    errors.email = 'Enter an email we can send your confirmation to.';
  if (digits < 6) errors.phone = 'Enter a phone number the courier can call.';
  else if (!/^[+\d][\d\s()-]*$/.test(v.phone.trim()))
    errors.phone = 'Use digits only, optionally starting with +.';
  if (v.line1.trim().length < 3) errors.line1 = 'Enter your street address.';
  if (v.city.trim().length < 2) errors.city = 'Enter your city.';
  // frontend#158/#163: free text is gone. A guest's governorate must resolve
  // to one of the 27 closed keys — the exact production incident this closes
  // was garbage text ("1111111") reaching checkout because this check only
  // looked at string length.
  if (!resolveGovernorateKey(v.governorate)) {
    errors.governorate = 'Select your governorate.';
  }

  return errors;
}

export function isGuestComplete(v: GuestCheckoutDetails): boolean {
  return Object.keys(validateGuest(v)).length === 0;
}

const fieldWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  // Without this a field inside a grid track refuses to shrink below its
  // intrinsic width and pushes the whole column past the viewport — the same
  // failure that ran the length of /cart and this flow's own layout.
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
};

/**
 * The border has to be VISIBLE, and on this background it was not.
 *
 * `--mr-line` is a hairline tuned for dividers on cream — perfect for
 * separating a summary row, far too faint to say "this is a box you type in".
 * The result was a column of labels with text floating under them: no field
 * looked like a field, and nothing told the shopper where one ended and the
 * next began (owner, 2026-08-21: "make border black on input fields to
 * distinguish… because look its bad").
 *
 * `--mr-fg` at 45% is the compromise that keeps the shop's ink palette while
 * clearing the 3:1 contrast a form control needs against its background. A
 * literal #000 would out-weigh the product photography this page sits beside.
 */
const inputStyle: React.CSSProperties = {
  font: 'inherit',
  // 16px, so iOS does not zoom the page when the field takes focus — the
  // single most common way a mobile form feels broken.
  fontSize: 16,
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--mr-fg) 45%, transparent)',
  // White, not the page's cream. A field that shares its background with the
  // page relies on the border alone to exist; giving it its own surface makes
  // it read as a control even before the border is noticed.
  background: 'var(--mr-bg-raised, #fff)',
  color: 'var(--mr-fg)',
  width: '100%',
  minWidth: 0,
  outline: 'none',
  transition:
    'border-color var(--mr-dur-fast, 160ms) var(--mr-ease-out, ease), box-shadow var(--mr-dur-fast, 160ms) var(--mr-ease-out, ease)',
};

const errorStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-ui)',
  fontSize: 'var(--mr-text-xs)',
  color: 'var(--mr-danger, #c0392b)',
};

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  optional,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <div style={fieldWrap}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {optional && (
          <span style={{ opacity: 0.6, letterSpacing: 'normal' }}> · optional</span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        /**
         * Focus is drawn inline rather than through a class because this file
         * carries its own styles. `outline: none` above would otherwise leave
         * keyboard users with no indication of where they are at all — the
         * ring below replaces it, it does not merely decorate.
         */
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--mr-fg)';
          e.currentTarget.style.boxShadow =
            '0 0 0 3px color-mix(in srgb, var(--mr-fg) 12%, transparent)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? 'var(--mr-danger, #c0392b)'
            : 'color-mix(in srgb, var(--mr-fg) 45%, transparent)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        // Real autocomplete tokens, so a phone fills the whole form from its
        // own address book in one tap. This is the single largest thing that
        // decides whether a guest form gets completed.
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          ...inputStyle,
          ...(error ? { borderColor: 'var(--mr-danger, #c0392b)' } : {}),
        }}
        data-trace-id={`PG-STOREFRONT-CHK-002::EL-FIELD-guest-${id}`}
      />
      {error && (
        <span id={`${id}-error`} role="alert" style={errorStyle}>
          {error}
        </span>
      )}
    </div>
  );
}

export default function GuestDetailsForm({
  value,
  onChange,
  errors,
  mobile,
  governorateHint,
}: {
  value: GuestCheckoutDetails;
  onChange: (next: GuestCheckoutDetails) => void;
  /** Only populated after a failed submit — see the page for why. */
  errors: GuestFieldErrors;
  mobile: boolean;
  /**
   * What this governorate costs, phrased by the page that owns the shipping
   * summary — still driven by the shop's rate table (#83), independent of
   * the closed-enum `GovernorateKeySelect` below (#158/#163) that now
   * decides the VALUE stored.
   */
  governorateHint?: React.ReactNode;
}) {
  const set = (patch: Partial<GuestCheckoutDetails>) =>
    onChange({ ...value, ...patch });

  // minmax(0, 1fr) rather than a bare 1fr, for the reason in fieldWrap above.
  const twoUp: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: 'var(--mr-sp-3)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
      <Field
        id="fullName"
        label="Full name"
        value={value.fullName}
        onChange={(v) => set({ fullName: v })}
        error={errors.fullName}
        autoComplete="name"
      />
      <div style={twoUp}>
        <Field
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          value={value.email}
          onChange={(v) => set({ email: v })}
          error={errors.email}
          autoComplete="email"
        />
        <Field
          id="phone"
          label="Phone"
          type="tel"
          inputMode="tel"
          value={value.phone}
          onChange={(v) => set({ phone: v })}
          error={errors.phone}
          autoComplete="tel"
        />
      </div>
      <p
        style={{
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 'var(--mr-text-xs)',
          color: 'var(--mr-fg-4)',
          margin: 0,
        }}
      >
        We send your confirmation by email, and the courier calls before
        delivery.
      </p>

      <div style={{ height: 1, background: 'var(--mr-hairline)' }} />

      <Field
        id="line1"
        label="Address"
        value={value.line1}
        onChange={(v) => set({ line1: v })}
        error={errors.line1}
        autoComplete="address-line1"
        placeholder="Street and building"
      />
      <Field
        id="line2"
        label="Apartment, floor"
        value={value.line2 ?? ''}
        onChange={(v) => set({ line2: v })}
        autoComplete="address-line2"
        optional
      />
      <div style={twoUp}>
        <Field
          id="city"
          label="City"
          value={value.city}
          onChange={(v) => set({ city: v })}
          error={errors.city}
          autoComplete="address-level2"
        />
        {/*
          Frontend#158/#163: the governorate is one of the 27 closed keys, no
          free text — a guest who typed garbage here ("1111111") is exactly
          the production incident that made this urgent. `GovernorateKeySelect`
          only ever emits a real `GovernorateKey`; the fee hint below still
          comes from the page's own `effective` shipping-rate lookup, which
          matches a `GovernorateKey` (e.g. "CAIRO") the same way it always
          matched free text, via `normaliseGovernorate`.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <GovernorateKeySelect
            /*
             * A value that is not a real key — legacy free text on a session
             * saved before this shipped — must NOT reach the native
             * `<select>` as-is: with no option matching it, the browser
             * silently falls back to selecting the first non-disabled
             * option (Alexandria), which is exactly the "silent snap to a
             * different city" failure this closed enum exists to prevent.
             * Resolve first; an unmatched value renders as the blank
             * placeholder instead.
             */
            value={resolveGovernorateKey(value.governorate) ?? ''}
            onChange={(key) => set({ governorate: key })}
            error={errors.governorate}
          />
          {governorateHint && (
            <span
              style={{
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-4)',
              }}
            >
              {governorateHint}
            </span>
          )}
        </div>
      </div>
      <Field
        id="postalCode"
        label="Postal code"
        value={value.postalCode ?? ''}
        onChange={(v) => set({ postalCode: v })}
        autoComplete="postal-code"
        inputMode="numeric"
        optional
      />
    </div>
  );
}

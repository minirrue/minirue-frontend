'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import {
  signupSchema,
  toE164,
  type SignupFormData,
  PASSWORD_HELPER,
} from '@/lib/auth/schemas';
import { DIAL_CODES, DEFAULT_DIAL_CODE } from '@/lib/auth/dial-codes';
import { blurActiveElement } from '@/lib/auth/blur-active-element';
import { setSession } from '@/lib/session';
import { apiRegister } from '@/lib/api/auth';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import type { ApiError } from '@/lib/api/client';

/**
 * A message worth showing a shopper. Some backend paths send nothing but the
 * HTTP reason phrase ("Conflict", "Unprocessable Entity"), and printing that
 * verbatim tells the person nothing about what to do next — so treat it as no
 * message at all and let the caller's own sentence through.
 */
const HTTP_REASON_PHRASES = new Set([
  'bad request',
  'unauthorized',
  'forbidden',
  'not found',
  'conflict',
  'unprocessable entity',
  'too many requests',
  'internal server error',
]);

function humanMessage(message: string | undefined | null): string | undefined {
  const trimmed = message?.trim();
  if (!trimmed) return undefined;
  return HTTP_REASON_PHRASES.has(trimmed.toLowerCase()) ? undefined : trimmed;
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    dialCode: DEFAULT_DIAL_CODE,
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof SignupFormData;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setApiError(null);
    setLoading(true);
    try {
      const data = await apiRegister({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email,
        password: form.password,
        phone: toE164(form.dialCode, form.phoneNumber),
      });
      // PAST THIS LINE THE ACCOUNT EXISTS. Nothing below may throw the shopper
      // back to an error message, because there is no error to report and no
      // useful thing for them to do about it — pressing the button again just
      // earns "an account with these details already exists" for the account
      // they successfully created a second ago. That is the exact sequence the
      // owner hit on 2026-08-01, and the culprit was cart merge / /auth/me,
      // neither of which is the sign-up.
      try {
        setSession({
          userId: data.user.userId,
          email: data.user.email,
          name:
            data.user.name ??
            `${form.firstName} ${form.lastName}`.trim(),
          role: data.user.role,
          createdAt: Date.now(),
        });
        // Best effort: a guest basket that fails to merge is worth a retry on
        // the next page load, not a failed sign-up.
        await syncCartAfterAuth();
      } catch {
        // Deliberately swallowed — see above.
      }
      // The redirect target (home) has no input at all, so if the field the
      // shopper last typed into (often confirm-password) is still focused
      // when it unmounts, mobile keyboards can stay open there with nothing
      // to explain it. Blur before navigating away.
      blurActiveElement();
      router.replace('/');
      return;
    } catch (err: unknown) {
      setLoading(false);
      const e = err as ApiError;
      if (!navigator.onLine || e.status === 0) {
        setApiError('Unable to connect. Check your connection.');
      } else if (e.status === 409) {
        // Both the email and the phone are unique, so a 409 can mean either —
        // show the server's own message rather than guessing at the email.
        setApiError(
          humanMessage(e.message) ?? 'An account with these details already exists.',
        );
      } else if (e.status === 422) {
        setApiError(humanMessage(e.message) ?? 'Please check your details.');
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <AuthShell>
      <h1
        style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 30,
          fontWeight: 500,
          color: 'var(--mr-ink-900)',
          marginBottom: 32,
          lineHeight: 1.15,
        }}
      >
        Create account
      </h1>
      <form
        onSubmit={handleSubmit}
        noValidate
        data-trace-id="PG-STOREFRONT-IAM-002::EL-FORM-signup-form"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          opacity: loading ? 0.7 : 1,
          transition: 'opacity 0.2s ease-out',
        }}
      >
        {apiError && (
          <ErrorBanner
            animated={false}
            message={apiError}
            traceId="PG-STOREFRONT-IAM-002::EL-REGION-api-error-banner"
          />
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 22,
          }}
        >
          <FormField
            id="firstName"
            type="text"
            label="First name"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            error={errors.firstName}
            traceId="PG-STOREFRONT-IAM-002::EL-FIELD-first-name"
          />
          <FormField
            id="lastName"
            type="text"
            label="Last name"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            error={errors.lastName}
            traceId="PG-STOREFRONT-IAM-002::EL-FIELD-last-name"
          />
        </div>
        <FormField
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email}
          traceId="PG-STOREFRONT-IAM-002::EL-FIELD-email"
        />

        {/* Dial code and local number are separate controls so the shopper never
            types a + prefix; they are joined into E.164 on submit.
            Country is a fixed narrow column (flex: 0 0 132px); phone flexes to
            fill the rest (flex: 1) and MUST keep `minWidth: 0` — without it a
            plain flex child defaults to a content-based min-width and refuses
            to shrink, shoving the country select out of the row instead of
            sharing it. flexWrap lets the pair wrap cleanly rather than overlap
            if a screen is ever too narrow for both. */}
        <div
          data-testid="phone-country-row"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}
        >
          <div
            data-testid="phone-country-field"
            style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 132px', minWidth: 0 }}
          >
            <label htmlFor="dialCode" style={fieldLabelStyle(errors.dialCode)}>
              Country
            </label>
            <select
              id="dialCode"
              value={form.dialCode}
              onChange={(e) => setForm((f) => ({ ...f, dialCode: e.target.value }))}
              data-trace-id="PG-STOREFRONT-IAM-002::EL-FIELD-dial-code"
              style={selectStyle(errors.dialCode)}
            >
              {DIAL_CODES.map((c) => (
                <option key={`${c.code}-${c.dial}`} value={c.dial}>
                  {c.code} {c.dial}
                </option>
              ))}
            </select>
            {errors.dialCode && <span style={fieldErrorStyle}>{errors.dialCode}</span>}
          </div>
          <div data-testid="phone-number-field" style={{ flex: '1 1 160px', minWidth: 0 }}>
            <FormField
              id="phoneNumber"
              type="tel"
              inputMode="tel"
              label="Phone number"
              autoComplete="tel-national"
              placeholder="1001234567"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              error={errors.phoneNumber}
              // Showing the E.164 result as they type is the point: a shopper who
              // types 01012431350 can see it saved as +201012431350 and not
              // +2001012431350, which is the mistake this field used to invite.
              helper={
                form.phoneNumber.trim()
                  ? `Saved as ${toE164(form.dialCode, form.phoneNumber)}`
                  : 'We use this for delivery updates only.'
              }
              traceId="PG-STOREFRONT-IAM-002::EL-FIELD-phone-number"
            />
          </div>
        </div>

        <FormField
          id="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password}
          helper={PASSWORD_HELPER}
          traceId="PG-STOREFRONT-IAM-002::EL-FIELD-password"
        />
        <FormField
          id="confirmPassword"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          error={errors.confirmPassword}
          traceId="PG-STOREFRONT-IAM-002::EL-FIELD-confirm-password"
        />

        <Button
          type="submit"
          disabled={loading}
          style={{ marginTop: 8 }}
          traceId="PG-STOREFRONT-IAM-002::EL-BTN-submit-signup"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p
        style={{
          marginTop: 28,
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 13,
          color: 'var(--mr-ink-400)',
          textAlign: 'center',
        }}
      >
        Already a member?{' '}
        <Link
          href="/login"
          data-trace-id="PG-STOREFRONT-IAM-002::EL-LINK-sign-in"
          style={{ color: 'var(--mr-ink-900)', textDecoration: 'none', fontWeight: 500 }}
        >
          Sign in →
        </Link>
      </p>
    </AuthShell>
  );
}

// The dial-code control is a native <select>, so it cannot go through the Input
// primitive. These mirror that primitive's label, underline and error styling so
// the two halves of the phone row read as one field.
function fieldLabelStyle(error?: string): React.CSSProperties {
  return {
    fontFamily: 'Jost, sans-serif',
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: error ? 'var(--mr-crimson-700)' : 'var(--mr-ink-500)',
  };
}

function selectStyle(error?: string): React.CSSProperties {
  return {
    width: '100%',
    padding: '13px 0',
    background: 'transparent',
    border: 'none',
    borderBottom: `1.5px solid ${error ? 'var(--mr-crimson-700)' : 'var(--mr-hairline)'}`,
    outline: 'none',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: 15,
    color: 'var(--mr-ink-900)',
  };
}

const fieldErrorStyle: React.CSSProperties = {
  fontFamily: 'Inter Tight, sans-serif',
  fontSize: 12,
  color: 'var(--mr-crimson-700)',
};

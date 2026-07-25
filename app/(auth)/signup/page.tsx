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
import { setSession } from '@/lib/session';
import { apiRegister } from '@/lib/api/auth';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import type { ApiError } from '@/lib/api/client';

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
      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name:
          data.user.name ??
          `${form.firstName} ${form.lastName}`.trim(),
        role: data.user.role,
        createdAt: Date.now(),
      });
      await syncCartAfterAuth();
      router.push('/');
    } catch (err: unknown) {
      setLoading(false);
      const e = err as ApiError;
      if (!navigator.onLine || e.status === 0) {
        setApiError('Unable to connect. Check your connection.');
      } else if (e.status === 409) {
        // Both the email and the phone are unique, so a 409 can mean either —
        // show the server's own message rather than guessing at the email.
        setApiError(
          e.message ?? 'An account with these details already exists.',
        );
      } else if (e.status === 422) {
        setApiError(e.message ?? 'Please check your details.');
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
            types a + prefix; they are joined into E.164 on submit. */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 132px' }}>
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
          <div style={{ flex: 1, minWidth: 0 }}>
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

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { loginSchema, type LoginFormData } from '@/lib/auth/schemas';
import { blurActiveElement } from '@/lib/auth/blur-active-element';
import { setSession } from '@/lib/session';
import { apiLogin, apiLogout } from '@/lib/api/auth';
import { clearAuthFlag } from '@/lib/auth/tokens';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import type { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [signInRequired, setSignInRequired] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionExpired(params.get('reason') === 'session-expired');
    setSignInRequired(params.get('reason') === 'sign-in-required');
  }, []);

  /**
   * Where to go after signing in.
   *
   * Reads BOTH names. The session-expired handler sends `next`, but the cart
   * and checkout guards have always sent `returnUrl` — a name this only ever
   * ignored. So a shopper bounced out of their cart signed in and landed on
   * the home page, with the cart they were trying to reach one click away and
   * no sign anything had gone wrong.
   *
   * Still only accepts a path, never an absolute URL: an open redirect here
   * would let a crafted sign-in link send someone elsewhere after they enter
   * a password.
   */
  const getNextPath = () => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('next') ?? params.get('returnUrl');
    return target?.startsWith('/') && !target.startsWith('//') ? target : '/';
  };
  const [form, setForm] = React.useState<LoginFormData>({ email: '', password: '', remember: false });
  const [errors, setErrors] = React.useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = React.useState(0);

  // Rate limit countdown effect
  React.useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const id = setInterval(() => {
      setRateLimitCountdown((n) => {
        if (n <= 1) { clearInterval(id); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [rateLimitCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rateLimitCountdown > 0) return;
    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginFormData;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setApiError(null);
    setLoading(true);
    try {
      const data = await apiLogin(form.email, form.password, form.remember === true);

      // The storefront is customer/guest-only — admin, staff, and
      // collaborator accounts belong on the dashboard, not here. apiLogin
      // already set httpOnly session cookies for this account, so revoke them
      // server-side (apiLogout) and clear the local hint rather than letting a
      // staff session leak into the storefront.
      if (data.user.role !== 'CUSTOMER') {
        await apiLogout().catch(() => undefined);
        clearAuthFlag();
        setLoading(false);
        setApiError('This account cannot be used on the storefront.');
        return;
      }

      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name ?? form.email.split('@')[0],
        role: data.user.role,
        createdAt: Date.now(),
      });
      await syncCartAfterAuth();
      // See signup/page.tsx: the redirect target may have no input at all,
      // so a still-focused field can leave a mobile keyboard stuck open there.
      blurActiveElement();
      router.push(getNextPath());
    } catch (err: unknown) {
      setLoading(false);
      const e = err as ApiError;
      if (!navigator.onLine || e.status === 0) {
        setApiError('Unable to connect. Check your connection.');
      } else if (e.status === 401) {
        setApiError('Email or password is incorrect.');
      } else if (e.status === 429) {
        setApiError('Too many attempts. Please wait a minute.');
        setRateLimitCountdown(60);
      } else if (e.status === 422) {
        setApiError(e.message ?? 'Please check your details.');
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, email: e.target.value }));
    setErrors((err) => ({ ...err, email: undefined }));
    setApiError(null);
    setRateLimitCountdown(0);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, password: e.target.value }));
    setErrors((err) => ({ ...err, password: undefined }));
    setApiError(null);
    setRateLimitCountdown(0);
  };

  const isSubmitDisabled = loading || rateLimitCountdown > 0;

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
        Sign in
      </h1>
      <form
        onSubmit={handleSubmit}
        noValidate
        data-trace-id="PG-STOREFRONT-IAM-001::EL-FORM-login-form"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          opacity: loading ? 0.7 : 1,
          transition: 'opacity 0.2s ease-out',
        }}
      >
        {sessionExpired && !apiError && (
          <div
            role="status"
            data-trace-id="PG-STOREFRONT-IAM-001::EL-REGION-session-expired-banner"
            style={{
              padding: '12px 16px',
              background: 'var(--mr-st-warn-bg)',
              color: 'var(--mr-st-warn-fg)',
              borderRadius: 'var(--mr-radius-md)',
              fontSize: 14,
            }}
          >
            Your session expired. Sign in again to continue.
          </div>
        )}
        {/* The cart and checkout guards sent no reason at all, so a shopper
            bounced out of their basket got a bare sign-in form with nothing
            explaining why they were looking at it. */}
        {signInRequired && !sessionExpired && !apiError && (
          <div
            role="status"
            data-trace-id="PG-STOREFRONT-IAM-001::EL-REGION-sign-in-required-banner"
            style={{
              padding: '12px 16px',
              background: 'var(--mr-st-info-bg)',
              color: 'var(--mr-st-info-fg)',
              borderRadius: 'var(--mr-radius-md)',
              fontSize: 14,
            }}
          >
            Sign in to continue — we&apos;ll take you straight back.
          </div>
        )}
        {apiError && (
          <ErrorBanner
            animated
            traceId="PG-STOREFRONT-IAM-001::EL-REGION-api-error-banner"
            message={
              rateLimitCountdown > 0
                ? `Too many attempts. Try again in ${rateLimitCountdown}s`
                : apiError
            }
          />
        )}
        <FormField
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={form.email}
          onChange={handleEmailChange}
          error={errors.email}
          traceId="PG-STOREFRONT-IAM-001::EL-FIELD-email"
        />
        <FormField
          id="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={handlePasswordChange}
          error={errors.password}
          traceId="PG-STOREFRONT-IAM-001::EL-FIELD-password"
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.remember ?? false}
              onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
              data-trace-id="PG-STOREFRONT-IAM-001::EL-CHECK-remember-me"
              style={{ accentColor: 'var(--mr-gold-500)', width: 14, height: 14 }}
            />
            <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 13, color: 'var(--mr-ink-500)' }}>
              Remember me
            </span>
          </label>
          <Link
            href="/forgot"
            data-trace-id="PG-STOREFRONT-IAM-001::EL-LINK-forgot-password"
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: 13,
              color: 'var(--mr-ink-400)',
              textDecoration: 'none',
            }}
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitDisabled}
          style={{ marginTop: 8 }}
          traceId="PG-STOREFRONT-IAM-001::EL-BTN-submit-login"
        >
          {loading ? 'Signing in…' : rateLimitCountdown > 0 ? `Try again in ${rateLimitCountdown}s` : 'Sign in'}
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
        New to MiniRue?{' '}
        <Link
          href="/signup"
          data-trace-id="PG-STOREFRONT-IAM-001::EL-LINK-create-account"
          style={{ color: 'var(--mr-ink-900)', textDecoration: 'none', fontWeight: 500 }}
        >
          Create account →
        </Link>
      </p>
    </AuthShell>
  );
}

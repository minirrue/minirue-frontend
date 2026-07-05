'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { loginSchema, type LoginFormData } from '@/lib/auth/schemas';
import { setSession } from '@/lib/session';
import { apiLogin } from '@/lib/api/auth';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import type { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionExpired(params.get('reason') === 'session-expired');
  }, []);

  const getNextPath = () => {
    const next = new URLSearchParams(window.location.search).get('next');
    return next?.startsWith('/') ? next : '/';
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
      const data = await apiLogin(form.email, form.password);
      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name ?? form.email.split('@')[0],
        role: data.user.role,
        createdAt: Date.now(),
      });
      await syncCartAfterAuth();
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
        {apiError && (
          <div
            role="alert"
            style={{
              background: 'hsl(0 72% 95%)',
              color: 'hsl(0 72% 30%)',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '13px',
              marginBottom: '12px',
              animation: 'mr-fade-up 0.25s ease-out',
            }}
          >
            {rateLimitCountdown > 0
              ? `Too many attempts. Try again in ${rateLimitCountdown}s`
              : apiError}
          </div>
        )}
        <FormField
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={form.email}
          onChange={handleEmailChange}
          error={errors.email}
        />
        <FormField
          id="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={handlePasswordChange}
          error={errors.password}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.remember ?? false}
              onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
              style={{ accentColor: 'var(--mr-gold-500)', width: 14, height: 14 }}
            />
            <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 13, color: 'var(--mr-ink-500)' }}>
              Remember me
            </span>
          </label>
          <Link
            href="/forgot"
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

        <Button type="submit" disabled={isSubmitDisabled} style={{ marginTop: 8 }}>
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
        <Link href="/signup" style={{ color: 'var(--mr-ink-900)', textDecoration: 'none', fontWeight: 500 }}>
          Create account →
        </Link>
      </p>
    </AuthShell>
  );
}

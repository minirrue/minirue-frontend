'use client';

import React, { Suspense } from 'react';
// Suspense wraps useSearchParams per Next.js App Router requirement
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiResetPassword } from '@/lib/api/auth';
import { PASSWORD_HELPER } from '@/lib/auth/schemas';
import type { ApiError } from '@/lib/api/client';

interface ResetForm {
  password: string;
  confirmPassword: string;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [form, setForm] = React.useState<ResetForm>({ password: '', confirmPassword: '' });
  const [errors, setErrors] = React.useState<Partial<Record<keyof ResetForm, string>>>({});
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setApiError(null);
    setLoading(true);
    try {
      await apiResetPassword(token, form.password);
      router.push('/login?reset=success');
    } catch (err: unknown) {
      setLoading(false);
      const e = err as ApiError;
      if (e.status === 400 || e.status === 404 || e.status === 410) {
        setApiError('This reset link has expired or is invalid. Please request a new one.');
      } else if (!navigator.onLine || e.status === 0) {
        setApiError('Unable to connect. Check your connection.');
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 26,
              fontWeight: 500,
              color: 'var(--mr-ink-900)',
              marginBottom: 12,
            }}
          >
            Invalid link
          </h2>
          <p
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: 14,
              color: 'var(--mr-ink-500)',
              marginBottom: 28,
              lineHeight: 1.55,
            }}
          >
            This reset link is missing or invalid. Please request a new one.
          </p>
          <Link
            href="/forgot"
            style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-gold-500)',
              textDecoration: 'none',
            }}
          >
            Request reset link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1
        style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 30,
          fontWeight: 500,
          color: 'var(--mr-ink-900)',
          marginBottom: 12,
          lineHeight: 1.15,
        }}
      >
        Set new password
      </h1>
      <p
        style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 14,
          color: 'var(--mr-ink-500)',
          marginBottom: 28,
          lineHeight: 1.55,
        }}
      >
        Choose a strong password for your account.
      </p>
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
        {apiError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '12px' }}>
            <ErrorBanner animated={false} message={apiError} />
            {(apiError.includes('expired') || apiError.includes('invalid')) && (
              <Link
                href="/forgot"
                style={{ fontSize: 13, color: 'var(--mr-crimson-700)', textDecoration: 'underline' }}
              >
                Request a new link
              </Link>
            )}
          </div>
        )}
        <FormField
          id="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => {
            setForm((f) => ({ ...f, password: e.target.value }));
            setErrors((err) => ({ ...err, password: undefined }));
          }}
          error={errors.password}
          helper={PASSWORD_HELPER}
        />
        <FormField
          id="confirmPassword"
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => {
            setForm((f) => ({ ...f, confirmPassword: e.target.value }));
            setErrors((err) => ({ ...err, confirmPassword: undefined }));
          }}
          error={errors.confirmPassword}
        />
        <Button type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Saving…' : 'Set new password'}
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
        <Link href="/login" style={{ color: 'var(--mr-ink-900)', textDecoration: 'none', fontWeight: 500 }}>
          ← Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

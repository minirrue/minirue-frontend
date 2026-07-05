'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { signupSchema, type SignupFormData, PASSWORD_HELPER } from '@/lib/auth/schemas';
import { setSession } from '@/lib/session';
import { apiRegister } from '@/lib/api/auth';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import type { ApiError } from '@/lib/api/client';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<SignupFormData>({
    firstName: '',
    email: '',
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
      const data = await apiRegister(form.firstName, form.email, form.password);
      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name ?? form.firstName,
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
        setApiError('An account with this email already exists.');
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
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          opacity: loading ? 0.7 : 1,
          transition: 'opacity 0.2s ease-out',
        }}
      >
        {apiError && <ErrorBanner animated={false} message={apiError} />}
        <FormField
          id="firstName"
          type="text"
          label="First name"
          autoComplete="given-name"
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
          error={errors.firstName}
        />
        <FormField
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email}
        />
        <FormField
          id="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password}
          helper={PASSWORD_HELPER}
        />
        <FormField
          id="confirmPassword"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          error={errors.confirmPassword}
        />

        <Button type="submit" disabled={loading} style={{ marginTop: 8 }}>
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
        <Link href="/login" style={{ color: 'var(--mr-ink-900)', textDecoration: 'none', fontWeight: 500 }}>
          Sign in →
        </Link>
      </p>
    </AuthShell>
  );
}

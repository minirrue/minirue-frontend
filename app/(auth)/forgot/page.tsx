'use client';

import React from 'react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { forgotSchema, type ForgotFormData } from '@/lib/auth/schemas';
import { apiForgotPassword } from '@/lib/api/auth';

export default function ForgotPage() {
  const [form, setForm] = React.useState<ForgotFormData>({ email: '' });
  const [errors, setErrors] = React.useState<Partial<Record<keyof ForgotFormData, string>>>({});
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [sentEmail, setSentEmail] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = forgotSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ForgotFormData;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await apiForgotPassword(form.email);
    } catch {
      // Swallow all errors — anti-enumeration (FR-007): always show success
    }
    setSentEmail(form.email);
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--mr-cream-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 22,
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 26,
              fontWeight: 500,
              color: 'var(--mr-ink-900)',
              marginBottom: 12,
            }}
          >
            Check your inbox
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
            Reset link sent to <strong>{sentEmail}</strong>.
            <br />
            Check your spam folder if it does not arrive.
          </p>
          <Link
            href="/login"
            style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-gold-500)',
              textDecoration: 'none',
            }}
          >
            Back to sign in
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
        Reset password
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
        Enter your email and we will send a reset link.
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
        <FormField
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ email: e.target.value })}
          error={errors.email}
        />
        <Button type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Sending…' : 'Send reset link'}
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

'use client';

import React from 'react';
import { COUNTRY_CODES, DEFAULT_DIAL } from '@/components/chat/country-codes';

export interface GuestContactValue {
  name: string;
  email: string;
  phoneCountry: string;
  phone: string;
}

interface GuestContactFormProps {
  onSubmit: (value: GuestContactValue) => void;
  submitting?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GuestContactForm({ onSubmit, submitting = false }: GuestContactFormProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phoneCountry, setPhoneCountry] = React.useState(DEFAULT_DIAL);
  const [phone, setPhone] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  const nameValid = name.trim().length > 0;
  const emailValid = EMAIL_RE.test(email.trim());
  const phoneValid = phone.trim().length > 0;
  const valid = nameValid && emailValid && phoneValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit({ name: name.trim(), email: email.trim(), phoneCountry, phone: phone.trim() });
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--mr-hairline)',
    borderRadius: 8,
    padding: '9px 12px',
    outline: 'none',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: 13,
    color: 'var(--mr-ink-900)',
    background: 'var(--mr-cream-200)',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: 11,
    color: 'var(--mr-ink-400)',
    marginBottom: 4,
    display: 'block',
  };

  const errorStyle: React.CSSProperties = {
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: 10,
    color: '#B3261E',
    marginTop: 3,
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Guest contact details"
      style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--mr-cream-100)' }}
    >
      <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-700)', margin: 0 }}>
        Please share your details so our team can reach you.
      </p>

      <div>
        <label style={labelStyle} htmlFor="mr-guest-name">Name</label>
        <input
          id="mr-guest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={fieldStyle}
          placeholder="Your name"
          autoComplete="name"
        />
        {touched && !nameValid && <div style={errorStyle}>Name is required.</div>}
      </div>

      <div>
        <label style={labelStyle} htmlFor="mr-guest-email">Email</label>
        <input
          id="mr-guest-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={fieldStyle}
          placeholder="you@example.com"
          autoComplete="email"
        />
        {touched && !emailValid && <div style={errorStyle}>A valid email is required.</div>}
      </div>

      <div>
        <label style={labelStyle} htmlFor="mr-guest-phone">Phone</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
          <select
            id="mr-guest-phone-country"
            aria-label="Country code"
            value={phoneCountry}
            onChange={(e) => setPhoneCountry(e.target.value)}
            title={COUNTRY_CODES.find((c) => c.dial === phoneCountry)?.label}
            style={{ ...fieldStyle, width: 88, flexShrink: 0, padding: '9px 6px', textOverflow: 'ellipsis' }}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.dial}>
                {c.dial} {c.label}
              </option>
            ))}
          </select>
          <input
            id="mr-guest-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
            placeholder="Phone number"
            autoComplete="tel-national"
            inputMode="tel"
          />
        </div>
        {touched && !phoneValid && <div style={errorStyle}>Phone number is required.</div>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: 4,
          background: 'var(--mr-ink-900)',
          color: 'var(--mr-cream-100)',
          border: 0,
          borderRadius: 8,
          padding: '10px 14px',
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? 'Sending…' : 'Continue'}
      </button>
    </form>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import type { CustomerProfile } from '@/lib/api/customers';
import { useUpdateCustomerProfile } from '@/lib/hooks/use-customer';
import type { ApiError } from '@/lib/api/client';

interface Props {
  profile: CustomerProfile;
}

export default function ProfileForm({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [success, setSuccess] = useState(false);
  const updateProfile = useUpdateCustomerProfile();

  useEffect(() => {
    setDisplayName(profile.displayName ?? '');
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
  }, [profile]);

  const loading = updateProfile.isPending;
  const error = updateProfile.isError
    ? ((updateProfile.error as unknown as ApiError).message ?? 'Failed to save changes. Please try again.')
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    try {
      await updateProfile.mutateAsync({
        displayName: displayName || undefined,
        firstName,
        lastName,
      });
      setSuccess(true);
    } catch {
      /* surfaced via mutation state */
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Display name */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Display Name</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How your name appears publicly"
          style={inputStyle}
          disabled={loading}
        />
      </label>

      {/* First + Last */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>First Name</span>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            style={inputStyle}
            disabled={loading}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Last Name</span>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            style={inputStyle}
            disabled={loading}
          />
        </label>
      </div>

      {/* Phone — read-only */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>
          Phone
          <span style={{ marginLeft: 8, fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', fontWeight: 400 }}>
            (contact support to update)
          </span>
        </span>
        <input
          type="tel"
          value={profile.phone ?? '—'}
          readOnly
          style={{ ...inputStyle, opacity: 0.55, cursor: 'not-allowed' }}
        />
      </label>

      {/* Tier — read-only */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Tier</span>
        <input
          type="text"
          value={profile.tier}
          readOnly
          style={{ ...inputStyle, opacity: 0.55, cursor: 'not-allowed' }}
        />
      </label>

      {error && (
        <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', margin: 0 }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" style={{ color: 'var(--mr-success)', fontSize: 'var(--mr-text-sm)', margin: 0 }}>
          Profile updated.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'var(--mr-accent)',
            color: 'var(--mr-cream-100)',
            border: 'none',
            borderRadius: 'var(--mr-radius-sm)',
            padding: '10px 24px',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: `opacity var(--mr-dur-fast) var(--mr-ease-out)`,
          }}
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const labelTextStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
  fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  border: '1px solid var(--mr-border)',
  borderRadius: 'var(--mr-radius-sm)',
  padding: '9px 12px',
  fontSize: 'var(--mr-text-sm)',
  fontFamily: 'var(--mr-font-ui)',
  color: 'var(--mr-fg)',
  background: 'var(--mr-bg-raised)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

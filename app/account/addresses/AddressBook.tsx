'use client';

import React, { useState } from 'react';
import {
  type Address,
  type AddressInput,
} from '@/lib/api/customers';
import {
  useCreateCustomerAddress,
  useDeleteCustomerAddress,
  useSetDefaultCustomerAddress,
} from '@/lib/hooks/use-customer';
import type { ApiError } from '@/lib/api/client';

interface Props {
  addresses: Address[];
}

const MAX_ADDRESSES = 5;

function AddressCard({
  address,
  onDelete,
  onSetDefault,
  busy,
}: {
  address: Address;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--mr-border)',
        borderRadius: 'var(--mr-radius-md)',
        padding: '16px 20px',
        background: 'var(--mr-bg-raised)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: busy ? 0.6 : 1,
        transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
      }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={badgeStyle}>{address.label}</span>
        {address.isDefault && (
          <span style={{ ...badgeStyle, color: 'var(--mr-accent)', background: 'rgba(149,120,60,0.1)' }}>
            Default
          </span>
        )}
      </div>

      <div style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-2)', lineHeight: 1.6 }}>
        <div>{address.line1}</div>
        {address.line2 && <div>{address.line2}</div>}
        <div>
          {address.city}, {address.governorate}
          {address.postalCode ? ` ${address.postalCode}` : ''}
        </div>
        <div>{address.countryCode}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        {!address.isDefault && (
          <button onClick={() => onSetDefault(address.id)} disabled={busy} style={ghostBtnStyle}>
            Set as default
          </button>
        )}
        <button
          onClick={() => onDelete(address.id)}
          disabled={busy}
          style={{ ...ghostBtnStyle, color: 'var(--mr-danger)', marginLeft: 'auto' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

const BLANK_FORM: AddressInput = {
  label: 'HOME',
  line1: '',
  line2: '',
  city: '',
  governorate: '',
  postalCode: '',
  countryCode: 'EG',
  isDefault: false,
};

export default function AddressBook({ addresses }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressInput>(BLANK_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createAddress = useCreateCustomerAddress();
  const deleteAddress = useDeleteCustomerAddress();
  const setDefaultAddress = useSetDefaultCustomerAddress();

  const saving = createAddress.isPending;
  const atMax = addresses.length >= MAX_ADDRESSES;

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteAddress.mutateAsync(id);
    } catch {
      /* query cache refreshes on success */
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setBusyId(id);
    try {
      await setDefaultAddress.mutateAsync(id);
    } catch {
      /* no-op */
    } finally {
      setBusyId(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (atMax) return;
    setFormError(null);
    try {
      await createAddress.mutateAsync({
        ...form,
        line2: form.line2 || undefined,
        postalCode: form.postalCode || undefined,
      });
      setForm(BLANK_FORM);
      setShowForm(false);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setFormError(apiErr.message ?? 'Failed to save address. Please try again.');
    }
  };

  const field =
    (key: keyof AddressInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <p style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)', margin: 0 }}>
          {addresses.length} / {MAX_ADDRESSES} addresses
        </p>
        {!atMax && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: 'var(--mr-accent)',
              color: 'var(--mr-cream-100)',
              border: 'none',
              borderRadius: 'var(--mr-radius-sm)',
              padding: '8px 18px',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Add Address
          </button>
        )}
        {atMax && (
          <p style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', fontFamily: 'var(--mr-font-label)', letterSpacing: '0.08em', margin: 0 }}>
            Maximum reached
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {addresses.length === 0 && !showForm && (
          <p style={{ color: 'var(--mr-fg-4)', fontSize: 'var(--mr-text-sm)' }}>
            No addresses saved yet.
          </p>
        )}
        {addresses.map((addr) => (
          <AddressCard
            key={addr.id}
            address={addr}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
            busy={busyId === addr.id}
          />
        ))}
      </div>

      {showForm && (
        <form
          onSubmit={handleAddSubmit}
          style={{
            marginTop: 20,
            border: '1px solid var(--mr-border)',
            borderRadius: 'var(--mr-radius-md)',
            padding: '20px 24px',
            background: 'var(--mr-bg-raised)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-sm)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-3)',
            }}
          >
            New Address
          </h3>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Label</span>
            <select value={form.label} onChange={field('label')} style={inputStyle} required>
              <option value="HOME">Home</option>
              <option value="WORK">Work</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Address Line 1</span>
            <input type="text" value={form.line1} onChange={field('line1')} required style={inputStyle} />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Address Line 2 (optional)</span>
            <input type="text" value={form.line2 ?? ''} onChange={field('line2')} style={inputStyle} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>City</span>
              <input type="text" value={form.city} onChange={field('city')} required style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Governorate</span>
              <input type="text" value={form.governorate} onChange={field('governorate')} required style={inputStyle} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Postal Code (optional)</span>
              <input type="text" value={form.postalCode ?? ''} onChange={field('postalCode')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Country Code</span>
              <input
                type="text"
                value={form.countryCode}
                onChange={field('countryCode')}
                required
                maxLength={2}
                placeholder="EG"
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isDefault ?? false}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              style={{ accentColor: 'var(--mr-accent)' }}
            />
            <span style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)' }}>
              Set as default address
            </span>
          </label>

          {formError && (
            <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', margin: 0 }}>
              {formError}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'var(--mr-accent)',
                color: 'var(--mr-cream-100)',
                border: 'none',
                borderRadius: 'var(--mr-radius-sm)',
                padding: '9px 20px',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save Address'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); setForm(BLANK_FORM); }}
              style={ghostBtnStyle}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  fontSize: 'var(--mr-text-xs)',
  fontFamily: 'var(--mr-font-label)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-4)',
  background: 'var(--mr-bg-sunken)',
  padding: '2px 8px',
  borderRadius: 'var(--mr-radius-pill)',
};
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelTextStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-4)',
};
const inputStyle: React.CSSProperties = {
  border: '1px solid var(--mr-border)',
  borderRadius: 'var(--mr-radius-sm)',
  padding: '8px 12px',
  fontSize: 'var(--mr-text-sm)',
  fontFamily: 'var(--mr-font-ui)',
  color: 'var(--mr-fg)',
  background: 'var(--mr-bg-raised)',
  width: '100%',
  boxSizing: 'border-box',
};
const ghostBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--mr-border)',
  borderRadius: 'var(--mr-radius-sm)',
  padding: '8px 16px',
  fontSize: 'var(--mr-text-xs)',
  fontFamily: 'var(--mr-font-label)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
  cursor: 'pointer',
};

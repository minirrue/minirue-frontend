'use client';

import React, { useState } from 'react';
import {
  type Address,
  type AddressInput,
} from '@/lib/api/customers';
import {
  useCreateCustomerAddress,
  useUpdateCustomerAddress,
  useDeleteCustomerAddress,
  useSetDefaultCustomerAddress,
} from '@/lib/hooks/use-customer';
import { formatApiError, type ApiError } from '@/lib/api/client';
import Button from '@/components/ui/Button';
import GovernorateKeySelect from '@/components/checkout/GovernorateKeySelect';
import {
  governorateLabel,
  resolveGovernorateKey,
  type GovernorateKey,
} from '@/lib/checkout/governorates';

/**
 * What to show for a saved address's governorate, whatever it holds.
 *
 * A new address always carries one of the 27 keys now, but an address saved
 * before #158 shipped can still carry free text ("Cairo", "القاهرة", "Cairo
 * Governorate"...). Rather than print that raw string beside addresses that
 * carry a real key, resolve it the same way the select does and show the
 * same label either way — the one case this can't fix is free text that
 * matches none of the 27, which still prints as typed rather than vanishing.
 */
function governorateDisplay(raw: string): string {
  const key = resolveGovernorateKey(raw);
  return key ? governorateLabel(key) : raw;
}

interface Props {
  addresses: Address[];
}

const MAX_ADDRESSES = 5;

/** The backend refuses to delete the default address while it is the only one. */
const SOLE_DEFAULT_HINT = 'Your only address cannot be deleted. Add another first.';

function AddressCard({
  address,
  onDelete,
  onSetDefault,
  onEdit,
  busy,
  canDelete,
  error,
}: {
  address: Address;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  /**
   * Owner requirement (2026-09-15, alongside the #158 governorate fix): every
   * saved address can be edited, not only the default one. Before this, the
   * card offered "Set as default" and "Delete" only — there was no way to fix
   * a typo, or a legacy free-text governorate, on an address once saved.
   */
  onEdit: (address: Address) => void;
  busy: boolean;
  canDelete: boolean;
  error: string | null;
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
          {address.city}, {governorateDisplay(address.governorate)}
          {address.postalCode ? ` ${address.postalCode}` : ''}
        </div>
        <div>{address.countryCode}</div>
      </div>

      {/* Wraps: two house-shape pills plus the hint do not fit one row at 390px. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4, alignItems: 'center' }}>
        <Button variant="outline" onClick={() => onEdit(address)} disabled={busy}>
          Edit
        </Button>
        {!address.isDefault && (
          <Button variant="outline" onClick={() => onSetDefault(address.id)} disabled={busy}>
            Set as default
          </Button>
        )}
        {!canDelete && (
          <span
            style={{
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
              lineHeight: 1.4,
            }}
          >
            {SOLE_DEFAULT_HINT}
          </span>
        )}
        <Button
          variant="dangerOutline"
          onClick={() => onDelete(address.id)}
          disabled={busy || !canDelete}
          title={canDelete ? undefined : SOLE_DEFAULT_HINT}
          ariaDisabled={!canDelete}
          style={{ marginLeft: 'auto' }}
        >
          Delete
        </Button>
      </div>

      {error && (
        <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-xs)', margin: 0 }}>
          {error}
        </p>
      )}
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
  /** Non-null while editing an existing address — the form re-uses the same fields either way. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [governorateError, setGovernorateError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ id: string; message: string } | null>(null);

  const createAddress = useCreateCustomerAddress();
  const updateAddress = useUpdateCustomerAddress();
  const deleteAddress = useDeleteCustomerAddress();
  const setDefaultAddress = useSetDefaultCustomerAddress();

  const saving = createAddress.isPending || updateAddress.isPending;
  const atMax = addresses.length >= MAX_ADDRESSES;

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
    setGovernorateError(null);
    setForm(BLANK_FORM);
  };

  const handleEdit = (address: Address) => {
    setEditingId(address.id);
    setFormError(null);
    setGovernorateError(null);
    // A legacy free-text governorate is resolved to its key so the closed
    // select shows the matching option; an unmatched one is left blank so
    // the shopper is forced to pick a real governorate before saving —
    // never silently kept as unresolvable text.
    const resolved = resolveGovernorateKey(address.governorate);
    setForm({
      label: address.label,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      governorate: resolved ?? '',
      postalCode: address.postalCode ?? '',
      countryCode: address.countryCode,
      isDefault: address.isDefault,
    });
    setShowForm(true);
  };

  // Both card actions used to swallow their error, so a refused delete looked
  // like a click that did nothing at all.
  const handleDelete = async (id: string) => {
    setBusyId(id);
    setCardError(null);
    try {
      await deleteAddress.mutateAsync(id);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setCardError({ id, message: formatApiError(apiErr, 'Could not delete this address.') });
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setBusyId(id);
    setCardError(null);
    try {
      await setDefaultAddress.mutateAsync(id);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setCardError({
        id,
        message: formatApiError(apiErr, 'Could not set this address as default.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId && atMax) return;
    setFormError(null);
    // No free text and no silent fallback (#158): a governorate that did not
    // resolve to one of the 27 keys must block the save, not go out as
    // whatever the field happened to hold. Applies to an edit exactly as it
    // does to a new address — an existing address with an unmatched legacy
    // governorate cannot be re-saved without fixing it here.
    if (!resolveGovernorateKey(form.governorate)) {
      setGovernorateError('Select a governorate.');
      return;
    }
    setGovernorateError(null);
    const payload = {
      ...form,
      line2: form.line2 || undefined,
      postalCode: form.postalCode || undefined,
    };
    try {
      if (editingId) {
        await updateAddress.mutateAsync({ id: editingId, input: payload });
      } else {
        await createAddress.mutateAsync(payload);
      }
      closeForm();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setFormError(
        formatApiError(
          apiErr,
          editingId ? 'Failed to update address. Please try again.' : 'Failed to save address. Please try again.',
        ),
      );
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
          <Button variant="gold" onClick={() => setShowForm(true)}>
            Add Address
          </Button>
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
            onEdit={handleEdit}
            busy={busyId === addr.id}
            canDelete={!(addr.isDefault && addresses.length === 1)}
            error={cardError?.id === addr.id ? cardError.message : null}
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
            {editingId ? 'Edit Address' : 'New Address'}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>City</span>
              <input type="text" value={form.city} onChange={field('city')} required style={inputStyle} />
            </label>
            <GovernorateKeySelect
              value={(form.governorate as GovernorateKey) || ''}
              onChange={(key) => {
                setForm((f) => ({ ...f, governorate: key }));
                setGovernorateError(null);
              }}
              error={governorateError ?? undefined}
              // Not the browser's native `required`: the placeholder option is
              // disabled, so an unanswered field already fails HTML5
              // constraint validation and a native tooltip would block
              // `handleAddSubmit` from ever running — including the
              // resolve-on-load case, where a LEGACY address can legitimately
              // arrive with something already selected. The explicit check in
              // `handleAddSubmit` is what actually enforces this, with a
              // message that matches the rest of this form's errors.
              required={false}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Postal Code (optional)</span>
              <input type="text" value={form.postalCode ?? ''} onChange={field('postalCode')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Country Code</span>
              <input
                type="text"
                value={form.countryCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase() }))
                }
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
            <Button variant="gold" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Address'}
            </Button>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
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

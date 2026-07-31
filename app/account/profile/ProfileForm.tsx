'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CustomerProfile } from '@/lib/api/customers';
import { useUpdateCustomerProfile, useUploadCustomerAvatar } from '@/lib/hooks/use-customer';
import type { ApiError } from '@/lib/api/client';
import GenericAvatarIcon from '@/components/ui/GenericAvatarIcon';
import AvatarCropSheet from '@/components/storefront/AvatarCropSheet';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';

interface Props {
  profile: CustomerProfile;
}

export default function ProfileForm({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [success, setSuccess] = useState(false);
  const updateProfile = useUpdateCustomerProfile();
  const uploadAvatar = useUploadCustomerAvatar();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // Task FF (2026-07-30), hardened 2026-07-31 after an owner report of the
  // upload succeeding but the account still showing the generic icon:
  // the cropped bytes for an avatar just uploaded THIS session, so the tile
  // renders locally instead of a guaranteed-cold-miss remote fetch of the
  // exact bytes the browser is already holding.
  //
  // `uploadedAvatarUrl` is the avatarUrl OUR OWN upload just produced —
  // tracked in state (not only a ref) because the render below must not
  // gate on `profile.avatarUrl` alone. `profile` is a prop from a query this
  // component does not own (ProfilePageClient's useCustomerProfile()); a
  // component test caught that if that prop lags even one render behind the
  // upload — for any reason — `profile.avatarUrl` is still falsy and the
  // ternary below fell through to the generic icon, discarding local bytes
  // that were sitting right there. That is precisely the failure shape the
  // owner reported: an upload that succeeded but a read that didn't (visibly)
  // reflect it. `avatarSrc` below reads OUR known-good URL as a fallback so
  // the icon can never mask a photo that this session knows exists.
  const [pendingAvatarFile, setPendingAvatarFile] = useState<Blob | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);

  // Only clear on a CONFLICTING truthy value — some other actor's change
  // (a different device, an admin action) — never merely because
  // `profile.avatarUrl` hasn't caught up to ours yet (still null, or still
  // the old value): that "still lagging" state is exactly the case this fix
  // exists to tolerate, and clearing on it would silently reproduce the bug.
  useEffect(() => {
    if (uploadedAvatarUrl !== null && profile.avatarUrl && profile.avatarUrl !== uploadedAvatarUrl) {
      setPendingAvatarFile(null);
      setUploadedAvatarUrl(null);
    }
  }, [profile.avatarUrl, uploadedAvatarUrl]);

  // The prop, or — until it catches up — the URL this session's own upload
  // just produced. Never the other way around: once `profile.avatarUrl`
  // reports something ELSE, the effect above already cleared
  // `uploadedAvatarUrl`, so a genuinely different value (a real removal, a
  // different account) is never overridden by a stale one.
  const avatarSrc = profile.avatarUrl ?? uploadedAvatarUrl;

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    setPickedFile(file);
    setCropOpen(true);
  };

  const handleCropped = async (blob: Blob) => {
    setCropOpen(false);
    try {
      const updated = await uploadAvatar.mutateAsync(blob);
      setUploadedAvatarUrl(updated.avatarUrl ?? null);
      setPendingAvatarFile(blob);
    } catch (err) {
      setAvatarError((err as ApiError).message ?? 'Failed to upload photo');
    } finally {
      setPickedFile(null);
    }
  };

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
        // Emptying the box means "go back to my first name", so it has to send
        // null. `undefined` is "leave it alone", which made the field impossible
        // to clear once set.
        displayName: displayName.trim() ? displayName.trim() : null,
        firstName,
        lastName,
      });
      setSuccess(true);
    } catch {
      /* surfaced via mutation state */
    }
  };

  return (
    <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <button
        type="button"
        onClick={() => avatarInputRef.current?.click()}
        aria-label="Change your photo"
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1px solid var(--mr-border)',
          background: 'var(--mr-bg-raised)',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--mr-fg-3)',
        }}
      >
        {avatarSrc ? (
          <UploadPreviewImage
            src={avatarSrc}
            localFile={pendingAvatarFile}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <GenericAvatarIcon size={32} />
        )}
      </button>
      <div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          style={{ display: 'none' }}
          onChange={handleAvatarPick}
        />
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadAvatar.isPending}
          style={{
            background: 'transparent',
            border: '1px solid var(--mr-border)',
            borderRadius: 'var(--mr-radius-sm)',
            padding: '8px 16px',
            fontSize: 'var(--mr-text-sm)',
            color: 'var(--mr-fg-2)',
            cursor: uploadAvatar.isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {uploadAvatar.isPending ? 'Uploading…' : avatarSrc ? 'Change photo' : 'Add a photo'}
        </button>
        {avatarError && (
          <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-xs)', margin: '6px 0 0' }}>
            {avatarError}
          </p>
        )}
      </div>
    </div>

    <AvatarCropSheet
      open={cropOpen}
      file={pickedFile}
      onCancel={() => {
        setCropOpen(false);
        setPickedFile(null);
      }}
      onCropped={handleCropped}
    />

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
    </>
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

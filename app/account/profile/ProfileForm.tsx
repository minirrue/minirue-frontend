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
  // Task FF (2026-07-30): the cropped bytes for an avatar just uploaded THIS
  // session, so the tile renders locally instead of a guaranteed-cold-miss
  // remote fetch of the exact bytes the browser is already holding.
  // `pendingAvatarUrlRef` records which `avatarUrl` that local file belongs
  // to — if `profile.avatarUrl` ever changes to something else WITHOUT going
  // through handleCropped (a background refetch landing an older value,
  // say), the stale local bytes must stop showing.
  const [pendingAvatarFile, setPendingAvatarFile] = useState<Blob | null>(null);
  const pendingAvatarUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      pendingAvatarUrlRef.current !== null &&
      profile.avatarUrl !== pendingAvatarUrlRef.current
    ) {
      setPendingAvatarFile(null);
      pendingAvatarUrlRef.current = null;
    }
  }, [profile.avatarUrl]);

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
      pendingAvatarUrlRef.current = updated.avatarUrl ?? null;
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
        {profile.avatarUrl ? (
          <UploadPreviewImage
            src={profile.avatarUrl}
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
          {uploadAvatar.isPending ? 'Uploading…' : profile.avatarUrl ? 'Change photo' : 'Add a photo'}
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

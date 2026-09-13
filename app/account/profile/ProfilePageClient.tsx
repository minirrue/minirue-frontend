'use client';

import React from 'react';
import { useCustomerProfile } from '@/lib/hooks/use-customer';
import Button from '@/components/ui/Button';
import ProfileForm from './ProfileForm';

function ProfileSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className="mr-skeleton-pulse"
          style={{
            display: 'block',
            height: 40,
            borderRadius: 'var(--mr-radius-sm)',
            background: 'var(--mr-bg-raised)',
            width: i === 1 ? '100%' : '70%',
          }}
        />
      ))}
    </div>
  );
}

export default function ProfilePageClient() {
  const { data: profile, isLoading, isError, refetch } = useCustomerProfile();

  return (
    <>
      <h1
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xl)',
          fontWeight: 600,
          margin: '0 0 28px',
          color: 'var(--mr-fg)',
        }}
      >
        Profile
      </h1>

      {isLoading && <ProfileSkeleton />}

      {isError && (
        <div>
          <p style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)' }}>
            Unable to load profile. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()} style={{ marginTop: 12 }}>
            Retry
          </Button>
        </div>
      )}

      {profile && <ProfileForm profile={profile} />}
    </>
  );
}

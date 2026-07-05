'use client';

import { useEffect, useState } from 'react';
import CustomerRoleBadge from './CustomerRoleBadge';
import { useUser } from '@/lib/hooks/use-auth';
import { useCustomerProfile } from '@/lib/hooks/use-customer';
import { Role } from '@/lib/auth/role';

function AccountIdentitySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span
        className="mr-skeleton-pulse"
        style={{ display: 'block', width: 180, height: 22, borderRadius: 4, background: 'var(--mr-bg-raised)' }}
      />
      <span
        className="mr-skeleton-pulse"
        style={{ display: 'block', width: 240, height: 14, borderRadius: 4, background: 'var(--mr-bg-raised)' }}
      />
    </div>
  );
}

export default function AccountIdentityStrip() {
  const { data: authUser, isLoading: authLoading } = useUser();
  const { data: profile, isLoading: profileLoading } = useCustomerProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loading = !mounted || authLoading || profileLoading;
  const displayName =
    profile?.displayName?.trim() ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    authUser?.name?.trim() ||
    authUser?.email?.split('@')[0] ||
    'Member';
  const email = authUser?.email ?? '';
  const role = authUser?.role ?? Role.CUSTOMER;

  return (
    <header
      style={{
        marginBottom: 32,
        paddingBottom: 24,
        borderBottom: '1px solid var(--mr-hairline)',
      }}
      aria-label="Account identity"
    >
      {loading ? (
        <AccountIdentitySkeleton />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px 14px',
              marginBottom: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--mr-font-serif)',
                fontSize: 'clamp(1.5rem, 2.5vw, 1.875rem)',
                fontWeight: 500,
                color: 'var(--mr-fg)',
                textWrap: 'balance',
              }}
            >
              {displayName}
            </p>
            <CustomerRoleBadge role={role} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg-3)',
              textWrap: 'pretty',
            }}
          >
            {email}
            {profile?.phone ? ` · ${profile.phone}` : ''}
          </p>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 'var(--mr-text-sm)',
              lineHeight: 1.55,
              color: 'var(--mr-fg-2)',
              maxWidth: '52ch',
              textWrap: 'pretty',
            }}
          >
            Manage your profile, delivery addresses, and order history. Your session is tied to your
            customer account on MiniRue.
          </p>
        </>
      )}
    </header>
  );
}

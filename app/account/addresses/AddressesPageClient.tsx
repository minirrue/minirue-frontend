'use client';

import React from 'react';
import { useCustomerAddresses } from '@/lib/hooks/use-customer';
import AddressBook from './AddressBook';

function AddressesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <span
          key={i}
          className="mr-skeleton-pulse"
          style={{
            display: 'block',
            height: 120,
            borderRadius: 'var(--mr-radius-md)',
            background: 'var(--mr-bg-raised)',
          }}
        />
      ))}
    </div>
  );
}

export default function AddressesPageClient() {
  const { data: addresses, isLoading, isError, refetch } = useCustomerAddresses();

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
        Addresses
      </h1>

      {isLoading && <AddressesSkeleton />}

      {isError && (
        <div>
          <p
            role="alert"
            style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', marginBottom: 12 }}
          >
            Unable to load addresses. Please try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              background: 'transparent',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-sm)',
              padding: '8px 16px',
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg-2)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && <AddressBook addresses={addresses ?? []} />}
    </>
  );
}

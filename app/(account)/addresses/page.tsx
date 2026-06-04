/**
 * Account Addresses page — server component
 * Identity domain: Customer aggregate
 * Data: GET /v1/customers/me/addresses
 */
import type { Metadata } from 'next';
import { apiGetAddresses, type Address } from '@/lib/api/customers';
import AddressBook from './AddressBook';

export const metadata: Metadata = { title: 'Addresses — My Account — MiniRue' };

export default async function AddressesPage() {
  let addresses: Address[] = [];
  let fetchError: string | null = null;

  try {
    addresses = await apiGetAddresses();
  } catch {
    fetchError = 'Unable to load addresses. Please refresh the page.';
    addresses = [];
  }

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

      {fetchError && (
        <p
          role="alert"
          style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', marginBottom: 20 }}
        >
          {fetchError}
        </p>
      )}

      <AddressBook initialAddresses={addresses} />
    </>
  );
}

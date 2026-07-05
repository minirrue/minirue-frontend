import type { Metadata } from 'next';
import AddressesPageClient from './AddressesPageClient';

export const metadata: Metadata = { title: 'Addresses — My Account — MiniRue' };

export default function AddressesPage() {
  return <AddressesPageClient />;
}

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import AddressesPageClient from './AddressesPageClient';

export const metadata: Metadata = { title: 'Addresses — My Account — MiniRue' };

export default async function AddressesPage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();
  return <AddressesPageClient />;
}

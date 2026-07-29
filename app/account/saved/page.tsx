import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import SavedPageClient from './SavedPageClient';

export const metadata: Metadata = { title: 'Saved — My Account — MiniRue' };

export default async function SavedPage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();
  return <SavedPageClient />;
}

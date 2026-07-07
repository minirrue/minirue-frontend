import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import ProfilePageClient from './ProfilePageClient';

export const metadata: Metadata = { title: 'Profile — My Account — MiniRue' };

export default async function ProfilePage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();
  return <ProfilePageClient />;
}

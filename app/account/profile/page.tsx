import type { Metadata } from 'next';
import ProfilePageClient from './ProfilePageClient';

export const metadata: Metadata = { title: 'Profile — My Account — MiniRue' };

export default function ProfilePage() {
  return <ProfilePageClient />;
}

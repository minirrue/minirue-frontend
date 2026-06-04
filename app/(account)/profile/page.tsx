/**
 * Account Profile page — server component
 * Identity domain: Customer aggregate
 * Data: GET /v1/customers/me
 */
import type { Metadata } from 'next';
import { apiGetMe } from '@/lib/api/customers';
import ProfileForm from './ProfileForm';

export const metadata: Metadata = { title: 'Profile — My Account — MiniRue' };

export default async function ProfilePage() {
  let profile;
  let fetchError: string | null = null;

  try {
    profile = await apiGetMe();
  } catch {
    fetchError = 'Unable to load profile. Please refresh the page.';
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
        Profile
      </h1>

      {fetchError && (
        <p style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)' }}>{fetchError}</p>
      )}

      {profile && <ProfileForm profile={profile} />}
    </>
  );
}

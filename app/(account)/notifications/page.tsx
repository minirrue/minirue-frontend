import type { Metadata } from 'next';
import { apiListNotifications } from '@/lib/api/notifications';
import NotificationsClient from './NotificationsClient';

export const metadata: Metadata = {
  title: 'Notifications — My Account — MiniRue',
  robots: 'noindex, nofollow',
};

export default async function NotificationsPage() {
  let notifications: Awaited<ReturnType<typeof apiListNotifications>>['data'] = [];

  try {
    const res = await apiListNotifications({ limit: 50 });
    notifications = res.data;
  } catch { /* show empty */ }

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
        Notifications
      </h1>

      <NotificationsClient initial={notifications} />
    </>
  );
}

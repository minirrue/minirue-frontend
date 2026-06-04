import { apiFetch } from './client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailOrderUpdates: boolean;
  emailPromotions: boolean;
  pushEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function apiListNotifications(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ data: Notification[]; total: number; limit: number; offset: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/notifications${qs}`, { auth: true });
}

export async function apiMarkNotificationRead(id: string): Promise<{ data: Notification }> {
  return apiFetch(`/notifications/${id}/read`, { method: 'PATCH', auth: true });
}

export async function apiMarkAllNotificationsRead(): Promise<{ count: number }> {
  return apiFetch('/notifications/read-all', { method: 'PATCH', auth: true });
}

export async function apiGetNotificationPreferences(): Promise<{ data: NotificationPreferences }> {
  return apiFetch('/notifications/preferences', { auth: true });
}

export async function apiUpdateNotificationPreferences(
  prefs: Partial<Pick<NotificationPreferences, 'emailOrderUpdates' | 'emailPromotions' | 'pushEnabled'>>,
): Promise<{ data: NotificationPreferences }> {
  return apiFetch('/notifications/preferences', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(prefs),
  });
}

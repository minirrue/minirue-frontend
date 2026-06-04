/**
 * Store settings API client
 * [TBD] Endpoint path inferred from task spec — confirm /v1/settings with backend team.
 */
import { apiFetch } from './client';

export interface StoreSettings {
  storeName: string;
  logoUrl: string | null;
  defaultCurrency: string;   // e.g. "EGP"
  contactEmail: string;
}

export async function apiGetSettings(): Promise<StoreSettings> {
  return apiFetch<StoreSettings>('/settings', { auth: true });
}

export async function apiUpdateSettings(input: Partial<StoreSettings>): Promise<StoreSettings> {
  return apiFetch<StoreSettings>('/settings', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(input),
  });
}

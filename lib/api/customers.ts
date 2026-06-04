import { apiFetch } from './client';

export interface CustomerProfile {
  customerId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  phone: string | null;
  phoneSearchHash: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  lifetimeSpendAmount: string;
  lifetimeSpendCurrency: string;
  gdprEraseRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: Address[];
}

export interface Address {
  id: string;
  customerId: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  line1: string;
  line2: string | null;
  city: string;
  governorate: string;
  postalCode: string | null;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ProfileUpdateInput {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface AddressInput {
  label?: 'HOME' | 'WORK' | 'OTHER';
  line1: string;
  line2?: string | null;
  city: string;
  governorate: string;
  postalCode?: string | null;
  countryCode?: string;
  isDefault?: boolean;
}

export async function apiGetMe(): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>('/customers/me', { auth: true });
}

export async function apiUpdateMe(input: ProfileUpdateInput): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>('/customers/me', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function apiGetAddresses(): Promise<Address[]> {
  return apiFetch<Address[]>('/customers/me/addresses', { auth: true });
}

export async function apiCreateAddress(input: AddressInput): Promise<Address> {
  return apiFetch<Address>('/customers/me/addresses', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function apiDeleteAddress(id: string): Promise<void> {
  return apiFetch<void>(`/customers/me/addresses/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiSetDefaultAddress(id: string): Promise<Address> {
  return apiFetch<Address>(`/customers/me/addresses/${id}/set-default`, {
    method: 'PATCH',
    auth: true,
  });
}

export type TierLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface AdminCustomerListItem {
  customerId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  emailVerified: boolean;
  tier: TierLevel;
  lifetimeSpendAmount: string;
  lifetimeSpendCurrency: string;
  gdprEraseRequestedAt: string | null;
  createdAt: string;
  addressCount: number;
}

export interface AdminCustomerListResponse {
  data: AdminCustomerListItem[];
  total: number;
  page: number;
  limit: number;
}

export async function apiAdminListCustomers(params?: {
  tier?: TierLevel;
  page?: number;
  limit?: number;
}): Promise<AdminCustomerListResponse> {
  const qs = new URLSearchParams();
  if (params?.tier) qs.set('tier', params.tier);
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<AdminCustomerListResponse>(`/customers${query}`, { auth: true });
}

export async function apiAdminGetCustomer(id: string): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>(`/customers/${id}`, { auth: true });
}

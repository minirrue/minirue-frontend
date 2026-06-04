/**
 * Analytics API client
 * [TBD] Endpoint paths inferred from task spec — confirm /v1/analytics/overview
 * and /v1/analytics/revenue with backend team.
 */
import { apiFetch } from './client';

export interface AnalyticsOverview {
  revenueToday: number;       // cents
  ordersThisMonth: number;
  newCustomersThisWeek: number;
  topProducts: TopProduct[];
}

export interface TopProduct {
  productId: number;
  productName: string;
  unitsSold: number;
  revenue: number;            // cents
}

export interface RevenueDay {
  date: string;               // ISO date YYYY-MM-DD
  revenue: number;            // cents
}

export interface RevenueResponse {
  data: RevenueDay[];
  totalRevenue: number;       // cents — sum of data range
}

export async function apiGetAnalyticsOverview(): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>('/analytics/overview', { auth: true });
}

export async function apiGetRevenue(params?: {
  days?: number;
}): Promise<RevenueResponse> {
  const qs = new URLSearchParams();
  if (params?.days != null) qs.set('days', String(params.days));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<RevenueResponse>(`/analytics/revenue${query}`, { auth: true });
}

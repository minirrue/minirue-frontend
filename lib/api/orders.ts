import { apiFetch } from './client';
// Canonical Order contract now lives in @minirue/contracts
// (packages/contracts/src/orders.ts) — was byte-for-byte identical between
// frontend and dashboard already, just declared twice.
import type {
  OrderStatus,
  ProductSnapshot,
  OrderItem,
  OrderStatusHistoryEntry,
  ShippingAddressSnapshot,
  Order,
} from '@minirue/contracts';
export type {
  OrderStatus,
  ProductSnapshot,
  OrderItem,
  OrderStatusHistoryEntry,
  ShippingAddressSnapshot,
  Order,
};

export interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

export async function apiGetOrders(params?: { page?: number; limit?: number }): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<OrdersResponse>(`/orders${query}`, { auth: true });
}

export async function apiGetOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}`, { auth: true });
}

export async function apiCancelOrder(id: string, reason?: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${id}/cancel`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

export async function apiAdminListOrders(params?: {
  status?: OrderStatus;
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<OrdersResponse>(`/orders/admin${query}`, { auth: true });
}

export async function apiAdminTransitionStatus(
  id: string,
  status: OrderStatus,
  reason?: string,
): Promise<Order> {
  return apiFetch<Order>(`/orders/admin/${id}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status, reason }),
  });
}

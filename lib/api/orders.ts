import { apiFetch } from './client';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface ProductSnapshot {
  name: string;
  brand: string;
  sizeMl: number;
  bottleType: string;
  sku: string;
}

export interface OrderItem {
  id: string;
  variantId: string;
  productSnapshot: ProductSnapshot;
  qty: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  lineTotalAmount: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ShippingAddressSnapshot {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  governorate: string;
  postalCode?: string;
  phone: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderSeq: number;
  userId: string;
  status: OrderStatus;
  subtotalAmount: string;
  subtotalCurrency: string;
  shippingAmount: string;
  totalAmount: string;
  totalCurrency: string;
  shippingAddressSnapshot: ShippingAddressSnapshot;
  notes: string | null;
  items: OrderItem[];
  statusHistory?: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

export async function apiGetOrders(params?: {
  page?: number;
  limit?: number;
  q?: string;
}): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.q) qs.set('q', params.q);
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

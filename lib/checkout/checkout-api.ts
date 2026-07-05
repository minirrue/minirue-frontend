/**
 * Checkout API client — POST /v1/checkout, GET /v1/orders
 */
import { apiFetch } from '../api/client';

export type PaymentMethod = 'COD' | 'INSTAPAY';

export interface CheckoutRequest {
  cartId: string;
  shippingAddressId: string;
  paymentMethod: PaymentMethod;
  receiptDataUrl?: string;
}

export interface OrderItemSummary {
  id: string;
  variantId: string;
  qty: number;
  unitPriceAmount: string;
  lineTotalAmount: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  totalCurrency: string;
  items: OrderItemSummary[];
  createdAt: string;
}

export interface OrderListResponse {
  data: OrderSummary[];
  total: number;
  page: number;
  limit: number;
}

export async function apiCheckout(
  body: CheckoutRequest,
  idempotencyKey: string,
): Promise<OrderSummary> {
  return apiFetch<OrderSummary>('/checkout', {
    method: 'POST',
    auth: true,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
}

export async function apiListOrders(
  page = 1,
  limit = 10,
): Promise<OrderListResponse> {
  return apiFetch<OrderListResponse>(
    `/orders?page=${page}&limit=${limit}`,
    { auth: true },
  );
}

export async function apiGetOrder(orderId: string): Promise<OrderSummary> {
  return apiFetch<OrderSummary>(`/orders/${orderId}`, { auth: true });
}

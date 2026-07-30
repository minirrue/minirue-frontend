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
  /**
   * What was bought, captured at purchase time. `imageUrl` is the product cover,
   * resolved by the API at read time (backend 0.38.0) — optional, because it is
   * null when the product has no cover.
   */
  productSnapshot?: {
    name?: string;
    brand?: string;
    imageUrl?: string | null;
    sku?: string;
    variantValues?: Record<string, string>;
  };
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  orderSeq: number;
  status: string;
  totalAmount: string;
  totalCurrency: string;
  items: OrderItemSummary[];
  createdAt: string;
  /**
   * Set together, both null unless the order has been refunded. The backend
   * DTO has always carried these (orders.mapper.ts) — this interface was the
   * thing dropping them, so the account pages had nothing to render even
   * after a refund actually happened.
   */
  refundedAt: string | null;
  refundedAmountCents: number | null;
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
  q?: string,
): Promise<OrderListResponse> {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('limit', String(limit));
  if (q) qs.set('q', q);
  return apiFetch<OrderListResponse>(`/orders?${qs.toString()}`, { auth: true });
}

export async function apiGetOrder(orderId: string): Promise<OrderSummary> {
  return apiFetch<OrderSummary>(`/orders/${orderId}`, { auth: true });
}

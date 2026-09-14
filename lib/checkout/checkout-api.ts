/**
 * Checkout API client — POST /v1/checkout, GET /v1/orders
 */
import { apiFetch } from '../api/client';
import { attributionHeaders } from '../analytics/attribution';
import { getCartSessionId } from '../api/cart';
import { isAuthenticated } from '../auth/tokens';
import type { GuestCheckoutDetails } from './checkout-session';

export type PaymentMethod = 'COD' | 'INSTAPAY';

export interface CheckoutRequest {
  cartId: string;
  /** Signed-in shopper: one of their saved addresses. Omitted by a guest. */
  shippingAddressId?: string;
  /**
   * Guest checkout (2026-08-21): who they are and where it goes, sent instead
   * of an address id. The server rejects a request carrying both — see
   * CheckoutRequestSchema.
   */
  guest?: { fullName: string; email: string; phone: string };
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    governorate: string;
    postalCode?: string;
  };
  paymentMethod: PaymentMethod;
  receiptDataUrl?: string;
  /**
   * The code the shopper typed — text only. There is deliberately no field for
   * an amount: the server recomputes the whole saving from this string, and
   * accepting a number here would let anyone place an order at any price.
   */
  discountCode?: string;
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
    /** Set members only, resolved at read time (backend 0.113.0) — for a product-page link. */
    productSlug?: string | null;
    categorySlug?: string | null;
  };
  /**
   * The set this row is a member of (#116). A set is stored as one row per
   * member; `lib/orders/order-lines.ts` folds them back into one line. Optional
   * throughout: an older backend sends none of these.
   */
  bundleId?: string | null;
  bundleLineKey?: string;
  bundle?: OrderItemBundle | null;
}

/** The set as bought — name, slug and picture frozen at checkout. */
export interface OrderItemBundle {
  id: string;
  /** Null when the set is gone and the order predates the snapshot. */
  name: string | null;
  slug: string | null;
  imageUrl: string | null;
  /** Sets held by this row's add; null on orders without a snapshot. */
  setQty: number | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  orderSeq: number;
  /**
   * Who bought it (backend `toOrderDto`): `userId` on an account order,
   * `guestContact` on a guest one — the other is null. Optional because an
   * older response, or a test fixture, may carry neither.
   */
  userId?: string | null;
  guestContact?: { fullName: string; phone: string; email?: string } | null;
  status: string;
  totalAmount: string;
  totalCurrency: string;
  /**
   * What the sets saved against their parts. Display only — already inside the
   * line prices and the total. Absent on an older backend.
   */
  bundleSavingsAmount?: string;
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

/**
 * Splits the one flat object the checkout UI holds into the two the API wants.
 *
 * The form is a single list of fields to the shopper, but the server keeps
 * WHO they are (guest_contact on the order) apart from WHERE it goes (the
 * address snapshot) — so the split belongs here, once, rather than in each of
 * the two pages that submit.
 */
export function guestCheckoutFields(guest: GuestCheckoutDetails): {
  guest: NonNullable<CheckoutRequest['guest']>;
  shippingAddress: NonNullable<CheckoutRequest['shippingAddress']>;
} {
  return {
    guest: {
      fullName: guest.fullName.trim(),
      email: guest.email.trim(),
      phone: guest.phone.trim(),
    },
    shippingAddress: {
      line1: guest.line1.trim(),
      // Empty optional fields are dropped, not sent as "". The server's schema
      // treats them as absent either way, but an empty string would be written
      // into the address snapshot and printed on the label as a blank line.
      ...(guest.line2?.trim() ? { line2: guest.line2.trim() } : {}),
      city: guest.city.trim(),
      governorate: guest.governorate.trim(),
      ...(guest.postalCode?.trim() ? { postalCode: guest.postalCode.trim() } : {}),
    },
  };
}

/**
 * `x-session-id` is what proves a GUEST owns the cart they are buying — the
 * server refuses an anonymous checkout without it (CartCheckoutAdapter). It is
 * harmless on a signed-in request, where the token identifies the buyer and
 * the cart is matched by user instead.
 */
function checkoutSessionHeaders(): Record<string, string> {
  const sid = getCartSessionId();
  return sid ? { 'x-session-id': sid } : {};
}

export async function apiCheckout(
  body: CheckoutRequest,
  idempotencyKey: string,
): Promise<OrderSummary> {
  return apiFetch<OrderSummary>('/checkout', {
    method: 'POST',
    /**
     * `auth` here is bookkeeping, not authorisation — credentials are sent on
     * every request regardless. What it controls is the 401-refresh path and,
     * on success, `markAuthenticated()`.
     *
     * So a GUEST must not set it: a successful guest order would otherwise
     * stamp the `mr-auth` hint, and the Edge proxy gates /account and /orders
     * on that flag alone. The guest would be waved into pages that then 401 —
     * signed in according to the proxy, anonymous according to the API.
     */
    auth: isAuthenticated(),
    headers: {
      'Idempotency-Key': idempotencyKey,
      ...checkoutSessionHeaders(),
      ...attributionHeaders(),
    },
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

/**
 * Fulfillment API client
 * Covers: shipments + tracking events for a given order, and admin shipment list.
 *
 * [TBD] Endpoint paths are inferred — confirm with backend once fulfillment
 *       module spec is published.
 *
 * Shipment statuses follow the carrier pipeline:
 *   CREATED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED | FAILED
 */
import { apiFetch } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ShipmentStatus =
  | 'CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED';

export interface Shipment {
  id: number;
  orderId: number;
  trackingNumber: string | null;
  courierName: string | null;
  status: ShipmentStatus;
  estimatedDelivery: string | null; // ISO date string
  createdAt: string;
  updatedAt: string;
}

export interface TrackingEvent {
  id: number;
  shipmentId: number;
  status: ShipmentStatus;
  location: string | null;
  description: string | null;
  occurredAt: string; // ISO date string
}

export interface ShipmentWithEvents extends Shipment {
  events: TrackingEvent[];
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Fetch the shipment record(s) for a given order.
 * Returns an array because an order can theoretically have multiple shipments
 * (split fulfilment). UI renders the first/primary one.
 * [TBD] Confirm whether endpoint returns array or single object.
 */
export async function apiGetShipmentsByOrder(orderId: string): Promise<Shipment[]> {
  return apiFetch<Shipment[]>(`/fulfillment/shipments?orderId=${orderId}`, { auth: true });
}

/**
 * Fetch detailed shipment with tracking event timeline.
 * [TBD] Endpoint path not confirmed — assumed /v1/fulfillment/shipments/:id/events
 *       or the shipment detail itself includes events.
 */
export async function apiGetShipmentWithEvents(shipmentId: number): Promise<ShipmentWithEvents> {
  return apiFetch<ShipmentWithEvents>(`/fulfillment/shipments/${shipmentId}`, { auth: true });
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

export interface AdminShipmentRow {
  id: number;
  orderId: number;
  orderNumber: string;
  status: ShipmentStatus;
  courier: string | null;       // alias for courierName
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  createdAt: string;
}

export interface AdminShipmentListResponse {
  data: AdminShipmentRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Admin: list all shipments with pagination and status filter.
 * [TBD] Confirm /v1/fulfillment/shipments returns orderNumber in the list response.
 */
export async function apiAdminListShipments(params?: {
  status?: ShipmentStatus;
  page?: number;
  pageSize?: number;
}): Promise<AdminShipmentListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<AdminShipmentListResponse>(`/fulfillment/shipments${query}`, { auth: true });
}

/**
 * Admin: update shipment status inline.
 * [TBD] Confirm PATCH /v1/fulfillment/shipments/:id/status endpoint.
 */
export async function apiUpdateShipmentStatus(
  id: number,
  status: ShipmentStatus,
): Promise<AdminShipmentRow> {
  return apiFetch<AdminShipmentRow>(`/fulfillment/shipments/${id}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status }),
  });
}

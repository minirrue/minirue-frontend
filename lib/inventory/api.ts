/**
 * Inventory domain — client-side API helpers.
 * Inventory is a supporting domain. Variant/product data is read from
 * catalog (GET /v1/catalog/products) via separate catalog API calls.
 *
 * [TBD] GET /v1/inventory/stock currently returns per-variantId only (bulk query).
 *       A full admin stock list endpoint (paginated, with variant name + SKU joined)
 *       is not specified in 07-api.md — this file assumes it exists at
 *       GET /v1/inventory/stock/admin or falls back to the bulk endpoint.
 *       Verify with backend team.
 *
 * [TBD] GET /v1/inventory/movements — endpoint not in 07-api.md spec.
 *       Mapped to StockAdjustmentLog (EN-002) but no HTTP contract exists yet.
 *
 * [TBD] POST /v1/inventory/stock/receive — not in 07-api.md.
 *       Admin receive-stock is currently only POST /v1/inventory/adjust (delta + reason).
 *       Using adjust endpoint as the receive mechanism with ADMIN_ADJUST type.
 *
 * [TBD] Warehouses — spec is single-warehouse MVP (no multi-warehouse in FR-001..FR-009).
 *       Warehouse pages are built but POST /v1/inventory/warehouses does not exist in spec.
 */

import { apiFetch } from '@/lib/api/client';

/* ── Types ── */

export type StockStatus = 'OK' | 'LOW' | 'OUT';

export interface StockAdminRow {
  variantId: string;
  productName: string;
  sku: string;
  /** [TBD] warehouse field not in MVP spec — defaulting to 'Default' */
  warehouse: string;
  stockQty: number;
  /** Reserved qty held in Redis — [TBD] not exposed via current API */
  reserved: number;
  /** available = stockQty - reserved */
  available: number;
  lowStockThreshold: number;
  status: StockStatus;
}

export interface StockAdminResponse {
  data: StockAdminRow[];
}

export interface AdjustStockInput {
  variantId: string;
  delta: number;
  reason: string;
}

export interface AdjustStockResponse {
  variantId: string;
  qtyBefore: number;
  qtyAfter: number;
  adjustmentLogId: string;
}

export type MovementType = 'ADMIN_ADJUST' | 'ORDER_DECREMENT' | 'RESERVATION_RELEASE' | 'SYSTEM';

export interface MovementRow {
  id: string;
  createdAt: string;
  adjustmentType: MovementType;
  productName: string;
  sku: string;
  /** [TBD] warehouse field not in MVP spec */
  warehouse: string;
  delta: number;
  reason: string;
  actorUserId: string | null;
}

export interface MovementsResponse {
  data: MovementRow[];
  /** [TBD] cursor-based pagination not confirmed in spec */
  nextCursor?: string;
}

export interface WarehouseRow {
  id: string;
  name: string;
  locationCode: string;
  isActive: boolean;
}

export interface WarehousesResponse {
  data: WarehouseRow[];
}

export interface CreateWarehouseInput {
  name: string;
  locationCode: string;
}

/* ── API functions ── */

/**
 * [TBD] Admin stock list — endpoint not in spec. Assumed to exist.
 * Falls back shape: { data: StockAdminRow[] }
 */
export function listStockAdmin(): Promise<StockAdminResponse> {
  return apiFetch<StockAdminResponse>('/inventory/stock/admin', { auth: true });
}

/**
 * Admin manual stock adjustment (used as "receive stock" — positive delta = receive).
 * Spec: POST /v1/inventory/adjust — requires Idempotency-Key header.
 */
export function adjustStock(
  input: AdjustStockInput,
  idempotencyKey: string,
): Promise<AdjustStockResponse> {
  return apiFetch<AdjustStockResponse>('/inventory/adjust', {
    method: 'POST',
    auth: true,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

/**
 * [TBD] Movement history — GET /v1/inventory/movements not in spec.
 * Maps to StockAdjustmentLog (EN-002) but no HTTP contract defined.
 */
export function listMovements(params: {
  type?: MovementType;
  from?: string;
  to?: string;
  cursor?: string;
}): Promise<MovementsResponse> {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.cursor) q.set('cursor', params.cursor);
  const qs = q.toString();
  return apiFetch<MovementsResponse>(`/inventory/movements${qs ? `?${qs}` : ''}`, { auth: true });
}

/**
 * [TBD] Warehouses — not in MVP spec (single-warehouse).
 * These endpoints are speculative; verify before wiring to real backend.
 */
export function listWarehouses(): Promise<WarehousesResponse> {
  return apiFetch<WarehousesResponse>('/inventory/warehouses', { auth: true });
}

export function createWarehouse(input: CreateWarehouseInput): Promise<WarehouseRow> {
  return apiFetch<WarehouseRow>('/inventory/warehouses', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

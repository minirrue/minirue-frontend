import { apiFetch } from './client';

export type RefundStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'CANCELLED';

export type RefundMethod = 'ORIGINAL_PAYMENT' | 'STORE_CREDIT' | 'BANK_TRANSFER';

export interface RefundTicket {
  id: string;
  orderId: string;
  customerId: string;
  status: RefundStatus;
  method: RefundMethod;
  requestedAmountCents: number;
  approvedAmountCents: number | null;
  reason: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function apiCreateRefund(data: {
  orderId: string;
  method: RefundMethod;
  requestedAmountCents: number;
  reason: string;
}): Promise<RefundTicket> {
  return apiFetch('/refunds', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiListMyRefunds(params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: RefundTicket[]; total: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/refunds${qs}`, { auth: true });
}

export async function apiGetMyRefund(ticketId: string): Promise<RefundTicket> {
  return apiFetch(`/refunds/${ticketId}`, { auth: true });
}

export async function apiCancelRefund(ticketId: string): Promise<RefundTicket> {
  return apiFetch(`/refunds/${ticketId}/cancel`, { method: 'PATCH', auth: true });
}

/**
 * Human label for a refund ticket status, matching the vocabulary the
 * dashboard already uses (RefundStatus is a fixed vocabulary, not free text,
 * so this is a lookup, not a transform) — the two sides must agree, since a
 * customer and an admin can be looking at the same ticket.
 */
const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REFUNDED: 'Refunded',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function formatRefundStatus(status: RefundStatus): string {
  return REFUND_STATUS_LABEL[status] ?? status;
}

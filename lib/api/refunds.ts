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

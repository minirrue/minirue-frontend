import { apiFetch } from './client';

export type PaymentMethod = 'COD' | 'INSTAPAY' | 'GATEWAY';
export type PaymentAttemptStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface PaymentAttempt {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentAttemptStatus;
  amountCents: number;
  gatewayReference: string | null;
  createdAt: string;
}

export async function apiInitiatePayment(
  orderId: string,
  method: PaymentMethod,
  idempotencyKey: string,
): Promise<PaymentAttempt> {
  return apiFetch<PaymentAttempt>('/payments/initiate', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ orderId, method, idempotencyKey }),
  });
}

export async function apiListOrderPayments(orderId: string): Promise<PaymentAttempt[]> {
  return apiFetch<PaymentAttempt[]>(`/payments/orders/${orderId}`, { auth: true });
}

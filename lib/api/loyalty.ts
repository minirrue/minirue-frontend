import { apiFetch } from './client';

export type PointsTxType =
  | 'EARN_ORDER'
  | 'EARN_SIGNUP'
  | 'EARN_EMAIL_VERIFIED'
  | 'REDEEM'
  | 'DEDUCT_REFUND'
  | 'EXPIRE'
  | 'MANUAL_ADJUST';

export interface LoyaltyAccount {
  id: string;
  customerId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
}

export interface PointsTransaction {
  id: string;
  type: PointsTxType;
  delta: number;
  balanceAfter: number;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export async function apiGetLoyaltyAccount(): Promise<LoyaltyAccount> {
  return apiFetch('/loyalty/account', { auth: true });
}

export async function apiGetLoyaltyTransactions(params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: PointsTransaction[]; total: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/loyalty/transactions${qs}`, { auth: true });
}

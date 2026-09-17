import { apiFetch } from './client';

export type PointsTxType =
  | 'EARN'
  | 'REVERSE'
  | 'ADJUST_COMPENSATION'
  | 'ADJUST_PENALTY'
  | 'ADJUST_CORRECTION';

export interface PointsTransaction {
  id: string;
  type: PointsTxType;
  points: number;
  delta: number;
  balanceAfter: number;
  orderId: string | null;
  actorId: string | null;
  reason: string | null;
  note: string | null;
  createdAt: string;
}

export interface LoyaltyOverview {
  id: string;
  customerId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lifetimeReversed: number;
  lifetimeAdjusted: number;
  history: PointsTransaction[];
  total: number;
  page: number;
  limit: number;
  rules: {
    pointsPerEgp: number;
    redemptionEnabled: boolean;
    milestonesEnabled: boolean;
    milestones: unknown[];
  };
}

/** One authenticated read keeps the balance and its ledger on the same snapshot. */
export async function apiGetMyLoyalty(params: { page?: number; limit?: number } = {}): Promise<LoyaltyOverview> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  return apiFetch<LoyaltyOverview>(`/me/loyalty?${query}`, { auth: true });
}

// Rollout aliases for callers that have not moved to the combined endpoint yet.
export type LoyaltyAccount = Pick<
  LoyaltyOverview,
  'id' | 'customerId' | 'balance' | 'lifetimeEarned' | 'lifetimeRedeemed'
>;

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

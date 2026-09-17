import { apiFetch } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));

import { apiGetMyLoyalty } from '@/lib/api/loyalty';

describe('customer loyalty API', () => {
  it('reads the authenticated combined balance and ledger endpoint with bounded paging', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ balance: 120, history: [] });

    await apiGetMyLoyalty({ page: 3, limit: 20 });

    expect(apiFetch).toHaveBeenCalledWith('/me/loyalty?page=3&limit=20', { auth: true });
  });

  it('defaults to the first 20 history entries', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ balance: 0, history: [] });

    await apiGetMyLoyalty();

    expect(apiFetch).toHaveBeenCalledWith('/me/loyalty?page=1&limit=20', { auth: true });
  });
});

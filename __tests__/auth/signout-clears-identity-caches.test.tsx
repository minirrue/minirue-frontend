/**
 * QC pass 3 (2026-07-31): "we are logged out and yet we can see our past
 * history" — the React Query half.
 *
 * Sign-out removed four exact cache keys (`['auth']`, `['auth','me']`,
 * `['customer','me']`, `['customer','addresses']`) and nothing else. React
 * Query serves a cached result SYNCHRONOUSLY on mount and only then refetches,
 * so everything outside that list stayed on screen as the previous account's
 * data: the order list, any order detail that had been opened, the saved
 * products, the cart, and the "may you review this" answer.
 *
 * Signing IN has the same hole from the other side. A session that dies
 * without the shopper pressing Sign out never runs the sign-out path at all,
 * so signing in as somebody else on that tab inherited the last person's
 * caches.
 *
 * The public shop caches (`['catalog']`, `['storefront']`) must survive both —
 * they are identical for everyone, and clearing them only puts a skeleton
 * flash on the page the shopper lands on.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '@/lib/hooks/use-auth';

jest.mock('@/lib/api/auth', () => ({
  apiLogout: jest.fn().mockResolvedValue(undefined),
  apiLogin: jest.fn(),
  apiRegister: jest.fn(),
  apiMe: jest.fn(),
}));

jest.mock('@/lib/cart/sync-after-auth', () => ({
  syncCartAfterAuth: jest.fn().mockResolvedValue(undefined),
}));

const PREVIOUS_ACCOUNT = [
  ['auth', 'me'],
  ['customer', 'me'],
  ['customer', 'addresses'],
  ['customer', 'wishlist', 'ids'],
  ['customer', 'wishlist', 'products'],
  ['orders'],
  ['order', 'order-abc'],
  ['cart'],
  ['reviews', 'eligibility', 'prod-1'],
] as const;

const PUBLIC_SHOP = [
  ['catalog', 'products', {}],
  ['catalog', 'categories'],
  ['storefront', 'chrome'],
] as const;

describe('signing out drops every cache that belonged to the previous account', () => {
  it('removes identity-bound queries and leaves the public shop alone', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const key of PREVIOUS_ACCOUNT) {
      client.setQueryData(key as unknown as unknown[], { leaked: true });
    }
    for (const key of PUBLIC_SHOP) {
      client.setQueryData(key as unknown as unknown[], { public: true });
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    for (const key of PREVIOUS_ACCOUNT) {
      expect({
        key,
        data: client.getQueryData(key as unknown as unknown[]),
      }).toEqual({ key, data: undefined });
    }
    for (const key of PUBLIC_SHOP) {
      expect({
        key,
        data: client.getQueryData(key as unknown as unknown[]),
      }).toEqual({ key, data: { public: true } });
    }
  });
});

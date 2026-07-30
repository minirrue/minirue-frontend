/**
 * Unit tests — lib/hooks/use-auth.ts `useUser()`.
 *
 * Root-cause coverage for "still logged out and I can see my last account
 * conversation" (support-widget leak investigation). SupportWidget derives
 * "am I signed in" from `useUser().data` alone. React Query does NOT reset
 * `data` to undefined when a background refetch fails — a query that once
 * succeeded keeps its last-known-good `data` alongside `isError: true`. A
 * session that expires or is revoked WITHOUT the shopper clicking "Sign out"
 * never runs useLogout (which removes the query outright), so nothing else
 * would have cleared it. These tests prove `useUser()` now closes that gap
 * itself, plus the cross-tab case: a sign-out in one tab must not leave a
 * second tab's cached user in place.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/hooks/query-client';

const mockApiMe = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  apiMe: (...args: unknown[]) => mockApiMe(...args),
}));

// use-client-query's `isClient` gate needs `window`, which jsdom provides,
// but it also needs `enabled` to actually be true — no extra mocking needed
// beyond apiMe.

import { useUser } from '@/lib/hooks/use-auth';

const ME_QUERY_KEY = ['auth', 'me'];

function Probe() {
  const { data, isError, refetch } = useUser();
  return (
    <div>
      <div data-testid="who">{data ? data.userId : 'anonymous'}</div>
      <div data-testid="error">{String(isError)}</div>
      <button onClick={() => void refetch()}>refetch</button>
    </div>
  );
}

function renderProbe() {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('useUser() — session-expiry and cross-tab robustness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('a 401 mid-session clears the cached user instead of keeping the last-known-good data (React Query default)', async () => {
    mockApiMe.mockResolvedValueOnce({
      userId: 'cust-1',
      email: 'a@example.com',
      name: 'Alex',
      role: 'CUSTOMER',
    });
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('cust-1'));

    // The session expires server-side with no click from the shopper —
    // the next background call to /auth/me simply 401s.
    mockApiMe.mockRejectedValueOnce({ status: 401, message: 'Session expired' });
    await act(async () => {
      screen.getByRole('button', { name: 'refetch' }).click();
    });

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('true'));
    // The critical assertion: `data` must not still be the pre-expiry user.
    expect(screen.getByTestId('who')).toHaveTextContent('anonymous');
  });

  it('session expiry without ever calling useLogout (no click) still resolves to signed-out', async () => {
    mockApiMe.mockResolvedValueOnce({
      userId: 'cust-2',
      email: 'b@example.com',
      name: 'Bay',
      role: 'CUSTOMER',
    });
    const queryClient = renderProbe();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('cust-2'));

    // Nothing here ever calls useLogout / clearSession / removeQueries by
    // hand — only the query re-running (e.g. the next poll) and finding the
    // session dead, exactly as happens with no button ever pressed.
    mockApiMe.mockRejectedValueOnce({ status: 401, message: 'Session expired' });
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ME_QUERY_KEY });
    });

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('anonymous'));
  });

  it('a sign-out in another tab clears this tab too (storage event on mr-session)', async () => {
    mockApiMe.mockResolvedValue({
      userId: 'cust-3',
      email: 'c@example.com',
      name: 'Cy',
      role: 'CUSTOMER',
    });
    const queryClient = renderProbe();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('cust-3'));
    expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeTruthy();

    // Simulate another tab's useLogout removing `mr-session` from
    // localStorage — a native `storage` event fires in THIS tab for that,
    // same as a real second window would produce. No further apiMe call is
    // queued, so the fix must react to the event itself, not a refetch.
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'mr-session', newValue: null }),
      );
    });

    await waitFor(() => expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeUndefined());
  });

  it('ignores unrelated storage events (does not nuke the session on every localStorage write)', async () => {
    mockApiMe.mockResolvedValue({
      userId: 'cust-4',
      email: 'd@example.com',
      name: 'Dee',
      role: 'CUSTOMER',
    });
    const queryClient = renderProbe();
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('cust-4'));

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'some-other-key', newValue: 'x' }),
      );
    });

    expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeTruthy();
  });
});

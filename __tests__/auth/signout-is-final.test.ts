/**
 * QC pass 2 (2026-07-31): "we are logged out and yet we can see our past
 * history in chat panel."
 *
 * Signing out has to be final on the client too. Two ways it was not:
 *
 *   1. `refreshSession()` opens with an echo shortcut — if another tab
 *      refreshed within REFRESH_ECHO_MS it answers "yes, you are signed in"
 *      from a timestamp alone, WITHOUT asking the server, and calls
 *      markAuthenticated() while doing it. Sign out, and the account poll's
 *      401 lands here milliseconds later and resurrects the mr-auth cookie.
 *
 *   2. The 401 branch was gated on `!_isRetry`, so a retried request that
 *      401'd again fell straight through to the generic error path and the
 *      local auth state was never cleared at all.
 *
 * Either one leaves the mr-auth hint set for a session the server has already
 * refused. The support widget treats that hint as "this person has an
 * account" and shows them a signed-in panel — which is the reported bug.
 */
import { apiFetch, markDeliberateSignOut } from '@/lib/api/client';
import { isAuthenticated, markAuthenticated, clearAuthFlag } from '@/lib/auth/tokens';

function jsonResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

describe('signing out is final on the client', () => {
  const realFetch = global.fetch;
  const realNow = Date.now;

  /**
   * client.ts keeps `deliberateSignOutAt` and `lastRefreshAt` in module
   * scope, and there is no reset hook — deliberately, since production has no
   * reason to rewind them. So each test jumps the clock ten minutes forward
   * instead, which puts it well clear of the previous test's sign-out quiet
   * window and refresh echo window without needing the module to cooperate.
   */
  let clockOffset = 0;

  beforeEach(() => {
    clearAuthFlag();
    jest.restoreAllMocks();
    clockOffset += 600_000;
    const base = realNow();
    Date.now = () => base + clockOffset;
  });

  afterEach(() => {
    global.fetch = realFetch;
    Date.now = realNow;
    clearAuthFlag();
  });

  it('does not attempt a refresh for a 401 that arrives just after sign-out', async () => {
    markAuthenticated();
    markDeliberateSignOut();

    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(401));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/auth/me', { auth: true })).rejects.toMatchObject({
      status: 401,
    });

    // Exactly one call: the original request. No POST to /auth/refresh, and
    // no retry — there is nothing to refresh once the shopper has signed out.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/me');
  });

  it('does not let the echo shortcut resurrect the mr-auth hint after sign-out', async () => {
    // Arm the echo window the way real life does: one successful refresh,
    // which stamps `lastRefreshAt`. Without this the echo branch is never
    // reached and the test proves nothing about it.
    markAuthenticated();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401)) // original
      .mockResolvedValueOnce(jsonResponse(200)) // /auth/refresh succeeds
      .mockResolvedValueOnce(jsonResponse(200, { ok: true })) as unknown as typeof fetch;
    await apiFetch('/account', { auth: true });

    // Now sign out. The cookies are gone, but `lastRefreshAt` is a second old,
    // so the echo shortcut is live.
    markDeliberateSignOut();
    clearAuthFlag();
    expect(isAuthenticated()).toBe(false);

    const afterSignOut = jest.fn().mockResolvedValue(jsonResponse(401));
    global.fetch = afterSignOut as unknown as typeof fetch;

    await expect(apiFetch('/auth/me', { auth: true })).rejects.toBeDefined();

    // Before the fix the echo branch answered "still signed in" from the
    // timestamp alone and called markAuthenticated(), bringing the flag back
    // from the dead for a session the server had just revoked.
    expect(isAuthenticated()).toBe(false);
    expect(afterSignOut).toHaveBeenCalledTimes(1);
  });

  it('clears local auth state when a RETRIED request 401s again', async () => {
    markAuthenticated();

    // Not a deliberate sign-out — an ordinary expiry. The first 401 triggers
    // a refresh, the refresh succeeds, the retry 401s anyway (revoked
    // server-side). That retry used to skip the clearing entirely.
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401)) // original
      .mockResolvedValueOnce(jsonResponse(200)) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(401)); // retry
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/account', { auth: true })).rejects.toMatchObject({
      status: 401,
    });

    expect(isAuthenticated()).toBe(false);
  });
});

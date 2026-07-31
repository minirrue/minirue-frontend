/**
 * Signing back in immediately after signing out must work.
 *
 * `deliberateSignOutAt` suppresses token refreshes for SIGN_OUT_QUIET_MS so a
 * sign-out cannot be undone by an in-flight 401. Correct — but nothing ever
 * cleared it, so it went on suppressing refreshes into the FIRST FIVE SECONDS
 * OF THE NEXT SESSION. Sign out, sign straight back in, and any authed request
 * that 401s in that window got no refresh; `apiFetch` then cleared the
 * `mr-auth` flag, and the Edge proxy — which gates /account on that flag alone
 * — bounced the shopper it had just let in back to /login.
 *
 * Reported as: "im signed in and when i tap on profile it redirects me to
 * /login thats a major bug".
 *
 * The fix is that `markSessionRecovered()` ends the window. It runs on any
 * successful authed response and after a successful refresh, both of which are
 * proof the session is alive — precisely when suppressing refreshes stops
 * being correct.
 */
import {
  apiFetch,
  markDeliberateSignOut,
  markSessionRecovered,
} from '@/lib/api/client';
import { markAuthenticated, clearAuthFlag, isAuthenticated } from '@/lib/auth/tokens';

function response(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

describe('signing in again right after signing out', () => {
  const realFetch = global.fetch;
  const realNow = Date.now;
  let clockOffset = 0;

  beforeEach(() => {
    clearAuthFlag();
    jest.restoreAllMocks();
    // Module-scope timers in client.ts have no reset hook, so each test jumps
    // the clock clear of the previous test's windows.
    clockOffset += 600_000;
    const base = realNow();
    Date.now = () => base + clockOffset;
  });

  afterEach(() => {
    global.fetch = realFetch;
    Date.now = realNow;
    clearAuthFlag();
  });

  it('attempts a refresh again once a session is proven alive', async () => {
    markDeliberateSignOut();

    // The new session proves itself: one successful authed response.
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(200, { ok: true })) as unknown as typeof fetch;
    markAuthenticated();
    await apiFetch('/auth/me', { auth: true });

    // Now a 401 arrives. Before the fix the quiet window was still open, so no
    // refresh was tried and the auth flag was cleared — which is what bounced
    // the shopper to /login. It must be attempted now.
    const afterProof = jest
      .fn()
      .mockResolvedValueOnce(response(401)) // the request
      .mockResolvedValueOnce(response(200)) // /auth/refresh — succeeds
      .mockResolvedValueOnce(response(200, { ok: true })); // the retry
    global.fetch = afterProof as unknown as typeof fetch;

    await apiFetch('/account', { auth: true });

    // Three calls means the refresh was actually attempted and the retry ran.
    expect(afterProof).toHaveBeenCalledTimes(3);
    expect(afterProof.mock.calls[1][0]).toContain('/auth/refresh');
    // And the shopper is still signed in — the flag survived.
    expect(isAuthenticated()).toBe(true);
  });

  it('markSessionRecovered on its own reopens refreshing', async () => {
    markDeliberateSignOut();
    markSessionRecovered();
    markAuthenticated();

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200, { ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiFetch('/account', { auth: true });

    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
  });

  it('still refuses to refresh during a genuine sign-out', async () => {
    // The protection this window exists for must survive: an in-flight 401
    // landing right after Sign out must NOT resurrect the session.
    markAuthenticated();
    markDeliberateSignOut();

    const fetchMock = jest.fn().mockResolvedValue(response(401));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/auth/me', { auth: true })).rejects.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isAuthenticated()).toBe(false);
  });
});

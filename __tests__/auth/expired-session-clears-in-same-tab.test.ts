/**
 * 2026-07-31, reported with a screenshot: the session-expired login page, and
 * beside it the support panel still showing the previous account's entire
 * conversation with a working composer.
 *
 * The widget was not at fault. `useUser()` dropped its cached identity only on
 * the `storage` event — and **`storage` does not fire in the tab that made the
 * change**, only in the others. So the ONE tab whose session had just died was
 * the ONE tab that never invalidated. Its `/auth/me` query has a 15-minute
 * `staleTime`, so it never refetched on its own either: `authUser` stayed
 * populated, `isLoggedIn` stayed true, and every consumer kept rendering the
 * signed-out shopper's data.
 *
 * The redirect to /login came from `apiFetch`'s 401 handler while the identity
 * cache it should have invalidated sat untouched in the same tab.
 *
 * These tests pin the same-tab signal at its source. The listener side lives in
 * `use-auth.ts`, which cannot be exercised without a React tree; what matters
 * here is that a 401 on an authed request ALWAYS emits the event, because that
 * is the half that was missing and the half a future refactor is most likely
 * to drop.
 */
import { apiFetch, IDENTITY_CLEARED_EVENT } from '@/lib/api/client';
import { markAuthenticated, clearAuthFlag } from '@/lib/auth/tokens';

function response(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

describe('a dead session clears identity in the tab that discovered it', () => {
  const realFetch = global.fetch;
  const realNow = Date.now;
  let clockOffset = 0;
  let fired: number;
  const onCleared = () => { fired += 1; };

  beforeEach(() => {
    fired = 0;
    clearAuthFlag();
    jest.restoreAllMocks();
    // client.ts holds `deliberateSignOutAt` / `lastRefreshAt` in module scope
    // with no reset hook, so each test jumps the clock clear of the previous
    // test's sign-out quiet window and refresh echo window.
    clockOffset += 600_000;
    const base = realNow();
    Date.now = () => base + clockOffset;
    window.addEventListener(IDENTITY_CLEARED_EVENT, onCleared);
  });

  afterEach(() => {
    window.removeEventListener(IDENTITY_CLEARED_EVENT, onCleared);
    global.fetch = realFetch;
    Date.now = realNow;
    clearAuthFlag();
  });

  it('emits the same-tab signal when an authed request 401s', async () => {
    markAuthenticated();
    // 401, then the refresh also fails — a genuinely dead session.
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401)) as unknown as typeof fetch;

    await expect(apiFetch('/auth/me', { auth: true })).rejects.toBeDefined();

    expect(fired).toBeGreaterThan(0);
  });

  it('emits even when there was no stored session flag to begin with', async () => {
    // The guard that gates the "your session expired" REDIRECT is
    // `hadSession`. Cache clearing must NOT be gated on it: a component can
    // still be holding a previous identity in memory after the flag has gone.
    expect(document.cookie).not.toContain('mr-auth=1');

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401)) as unknown as typeof fetch;

    await expect(apiFetch('/account', { auth: true })).rejects.toBeDefined();

    expect(fired).toBeGreaterThan(0);
  });

  it('does not fire for a successful authed request', async () => {
    markAuthenticated();
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(200, { ok: true })) as unknown as typeof fetch;

    await apiFetch('/auth/me', { auth: true });

    expect(fired).toBe(0);
  });
});

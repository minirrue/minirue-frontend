/**
 * QC pass 3 (2026-07-31): "we are logged out and yet we can see our past
 * history in chat panel" — the two-tab version.
 *
 * Every piece of sign-out state in lib/api/client.ts is a MODULE variable, so
 * there is one copy per tab. The BroadcastChannel it opens carried exactly one
 * message kind, `refreshed`, and nothing at all for sign-out. Consequences,
 * both reproduced below:
 *
 *   1. Tab A signs out. Tab B never hears about it, so tab B's
 *      `deliberateSignOutAt` stays 0 and its `lastRefreshAt` stays recent —
 *      and tab B's very next 401 takes refreshSession()'s echo shortcut,
 *      which answers "yes, you are signed in" from that timestamp alone and
 *      calls markAuthenticated(). The `mr-auth` hint cookie is shared across
 *      tabs, so tab B resurrects the exact cookie tab A deliberately cleared.
 *      That cookie is what the Edge proxy reads to let someone into /account
 *      and /orders, and what SupportWidget's stored-session veto reads to
 *      decide the chat panel belongs to somebody with an account.
 *
 *   2. A `refreshed` message already on the wire when the shopper signs out
 *      lands afterwards and does the same thing — whichever of the two
 *      messages happened to be delivered last decided whether the browser
 *      ended up signed in.
 */

/** jsdom implements no BroadcastChannel at all, so without this the listener
 *  in client.ts is never even registered and the test would pass vacuously. */
class FakeBroadcastChannel {
  static open: FakeBroadcastChannel[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public name: string) {
    FakeBroadcastChannel.open.push(this);
  }
  postMessage(data: unknown): void {
    // Per spec a channel never receives its own posts; every other live
    // channel with the same name does, asynchronously.
    for (const ch of FakeBroadcastChannel.open) {
      if (ch === this || ch.name !== this.name) continue;
      setTimeout(() => ch.onmessage?.({ data }), 0);
    }
  }
  close(): void {
    FakeBroadcastChannel.open = FakeBroadcastChannel.open.filter((c) => c !== this);
  }
}

(globalThis as unknown as Record<string, unknown>).BroadcastChannel =
  FakeBroadcastChannel;

/* eslint-disable @typescript-eslint/no-require-imports */
// require, not import: the polyfill above has to exist BEFORE client.ts's
// module body runs, and import statements are hoisted above it.
const { apiFetch, markDeliberateSignOut } = require('@/lib/api/client') as
  typeof import('@/lib/api/client');
const { isAuthenticated, markAuthenticated, clearAuthFlag } = require('@/lib/auth/tokens') as
  typeof import('@/lib/auth/tokens');
const { setSession, getSession } = require('@/lib/session') as typeof import('@/lib/session');
/* eslint-enable @typescript-eslint/no-require-imports */

function jsonResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

/** Lets the fake channel's setTimeout(0) deliveries run. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Stands in for the OTHER tab. */
function otherTab() {
  return new FakeBroadcastChannel('mr-auth');
}

describe('a sign-out in one tab reaches every other tab', () => {
  const realFetch = global.fetch;
  const realNow = Date.now;
  // client.ts keeps its sign-out/refresh timestamps in module scope with no
  // reset hook, so each test jumps the clock clear of the previous one's
  // quiet window rather than asking the module to cooperate.
  let clockOffset = 0;

  beforeEach(() => {
    clearAuthFlag();
    localStorage.clear();
    clockOffset += 600_000;
    const base = realNow();
    Date.now = () => base + clockOffset;
  });

  afterEach(async () => {
    await flush();
    global.fetch = realFetch;
    Date.now = realNow;
    clearAuthFlag();
  });

  it('drops the mr-auth hint, the stored session and the refresh echo when another tab signs out', async () => {
    markAuthenticated();
    setSession({
      userId: 'u1',
      email: 'a@b.c',
      name: 'A',
      role: 'CUSTOMER',
      createdAt: Date.now(),
    });

    // Arm the echo window the way real life does — one successful refresh,
    // which stamps `lastRefreshAt`. Without this the echo branch is never
    // reached and the second half of this test proves nothing.
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401)) // original
      .mockResolvedValueOnce(jsonResponse(200)) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { ok: true })) as unknown as typeof fetch;
    await apiFetch('/account', { auth: true });
    expect(isAuthenticated()).toBe(true);

    // The other tab signs out. Cookies are httpOnly and cleared by the server
    // for the whole browser; this message is the only thing that tells THIS
    // tab's module state about it.
    const tabA = otherTab();
    tabA.postMessage({ kind: 'signed-out', at: Date.now() });
    await flush();

    expect(isAuthenticated()).toBe(false);
    expect(getSession()).toBeNull();

    // And the echo shortcut is disarmed: the next 401 must not answer "still
    // signed in" from a timestamp, and must not even try to refresh.
    const afterSignOut = jest.fn().mockResolvedValue(jsonResponse(401));
    global.fetch = afterSignOut as unknown as typeof fetch;
    await expect(apiFetch('/auth/me', { auth: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(afterSignOut).toHaveBeenCalledTimes(1);
    expect(afterSignOut.mock.calls[0][0]).toContain('/auth/me');
    expect(isAuthenticated()).toBe(false);

    tabA.close();
  });

  it('ignores a `refreshed` message that arrives after this tab signed out', async () => {
    markDeliberateSignOut();
    clearAuthFlag();
    expect(isAuthenticated()).toBe(false);

    // A refresh that was already in flight in the other tab when the shopper
    // pressed Sign out. It must not be allowed to re-set the hint cookie.
    const tabA = otherTab();
    tabA.postMessage({ kind: 'refreshed', at: Date.now() });
    await flush();

    expect(isAuthenticated()).toBe(false);

    tabA.close();
  });

  it('still honours a `refreshed` message when nobody has signed out', async () => {
    // The guard must not break the thing the channel was built for.
    clearAuthFlag();
    const tabA = otherTab();
    tabA.postMessage({ kind: 'refreshed', at: Date.now() });
    await flush();

    expect(isAuthenticated()).toBe(true);

    tabA.close();
  });
});

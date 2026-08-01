import { markAuthenticated, clearAuthFlag, isAuthenticated } from '@/lib/auth/tokens';
import { clearSession } from '@/lib/session';

export interface ApiError {
  status: number;
  /**
   * A sentence, OR a list of them — and the union is not pedantry.
   *
   * class-validator's 422 body carries `message` as an ARRAY (`["password is
   * not strong enough"]`), and Zod's as an array of `{ field, issue }`. This
   * was typed `string`, so every call site believed it could use it as one.
   * `app/(auth)/signup/page.tsx` called `.trim()` on it, which THREW inside
   * the catch block — so `setApiError` never ran and the sign-up page showed
   * the shopper nothing at all while the network tab held a perfectly clear
   * explanation (owner, 2026-08-01: "nothing on frontend said something").
   *
   * Never render this directly. `formatApiError` handles every shape.
   */
  message: string | string[] | unknown;
  error?: string;
}

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

export type SessionExpiredHandler = (path: string) => void;
let onSessionExpired: SessionExpiredHandler | null = null;

/** Register a handler for auth expiry (e.g. redirect to login with return URL). */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler;
}

/**
 * One shared refresh attempt. Several hooks poll at once (storefront chrome,
 * cart, the support widget every 4s), so an expired session produced a burst of
 * parallel /auth/refresh calls — each failing, each firing the expiry handler.
 * They now all await the same promise.
 */
let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Tells the shopper's OTHER tabs when a refresh has just happened.
 *
 * The de-dupe above is per tab, so two tabs could still post the same
 * single-use refresh token milliseconds apart — one won, the other was told
 * its session had expired and bounced to /login. That is the "random" logout
 * with several MiniRue tabs open.
 *
 * Backend 0.52.0 fixes this properly with a rotation grace window, so this is
 * belt and braces: it also stops the second call being made at all, which
 * saves a round trip and a needless token rotation. Absent in older browsers,
 * where the server-side grace window still covers it.
 */
const AUTH_CHANNEL = 'mr-auth';
let lastRefreshAt = 0;
const REFRESH_ECHO_MS = 3_000;

function postAuthMessage(message: { kind: string; at: number }): void {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.postMessage(message);
    ch.close();
  } catch {
    // A browser that refuses the channel simply falls back to the server's
    // own checks (the rotation grace window, the sid revocation check).
  }
}

function announceRefresh() {
  lastRefreshAt = Date.now();
  postAuthMessage({ kind: 'refreshed', at: lastRefreshAt });
}

/**
 * Tells the shopper's OTHER tabs that they deliberately signed out.
 *
 * The channel used to carry `refreshed` and nothing else, and every piece of
 * sign-out state below (`deliberateSignOutAt`, `lastRefreshAt`) is a MODULE
 * variable — one copy per tab. So a sign-out in tab A left tab B believing it
 * had refreshed a moment ago, and tab B's very next 401 took the echo
 * shortcut in refreshSession(): it answered "yes, you are signed in" from
 * that timestamp without asking the server, and called markAuthenticated(),
 * which re-created the `mr-auth` hint cookie. Cookies are shared across tabs,
 * so tab B resurrected the hint that tab A had just deliberately cleared —
 * and `mr-auth` is what the Edge proxy (proxy.ts:185) reads to let someone
 * into /account and /orders, and what SupportWidget's stored-session veto
 * reads to decide the chat panel belongs to someone with an account.
 *
 * That is the reported "we are logged out and yet we can see our past history
 * in the chat panel", reproduced with two tabs open and nothing else.
 */
function announceSignedOut() {
  postAuthMessage({ kind: 'signed-out', at: deliberateSignOutAt });
}

if (typeof BroadcastChannel !== 'undefined') {
  try {
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.onmessage = (e: MessageEvent<{ kind?: string; at?: number }>) => {
      if (e.data?.kind === 'signed-out') {
        // Adopt the other tab's sign-out as our own: the quiet window stops
        // this tab announcing "your session expired" for what was a
        // deliberate departure, AND stops refreshSession() from doing
        // anything at all (its first line is this same check).
        deliberateSignOutAt = Math.max(deliberateSignOutAt, e.data.at ?? Date.now());
        sessionExpiryAnnounced = true;
        // The echo shortcut must not be able to speak for a session that has
        // just ended. Zeroed, not decremented — there is nothing to echo.
        lastRefreshAt = 0;
        clearAuthFlag();
        clearSession();
        // Same reason as the 401 path: `clearSession()` here fires `storage`
        // in every tab EXCEPT this one, so without this the tab that received
        // the sign-out broadcast would keep its cached identity on screen.
        announceIdentityCleared();
        return;
      }
      if (e.data?.kind === 'refreshed') {
        // A `refreshed` that crosses a sign-out on the wire must lose. Without
        // this, the losing order of two in-flight messages decides whether the
        // browser ends up signed in.
        if (Date.now() - deliberateSignOutAt < SIGN_OUT_QUIET_MS) return;
        lastRefreshAt = Math.max(lastRefreshAt, e.data.at ?? Date.now());
        markAuthenticated();
      }
    };
  } catch {
    // Non-fatal — see above.
  }
}

/**
 * What a refresh attempt actually established — three answers, not two.
 *
 * `false` used to mean both "the server says this browser has no session" and
 * "we could not ask", and collapsing them is what turned a rate limit into a
 * sign-out. See the 401 handler in apiFetch for the consequence of each.
 */
type RefreshOutcome =
  /** New cookies are in place. Retry the request. */
  | 'refreshed'
  /** The SERVER refused: 401/403. This browser really has no session. */
  | 'refused'
  /** We never got an answer: 429, 5xx, offline, or a cooldown. Nothing proven. */
  | 'unavailable';

/**
 * Refusing to ask again for a while after an unanswerable attempt.
 *
 * Every 401 on an authed request triggers a refresh, and there is no shortage
 * of authed requests. Once /auth/refresh starts 429ing, retrying it on the next
 * 401 is how a browser spends its whole rate-limit budget in a couple of
 * seconds and then gets 429s on requests that would otherwise have worked —
 * including the /auth/me straight after a successful sign-up, which is what
 * showed the customer "something went wrong" for an account that had in fact
 * been created (2026-08-01).
 */
let refreshBlockedUntil = 0;
const REFRESH_UNAVAILABLE_COOLDOWN_MS = 30_000;

/**
 * And after a REFUSAL: the server has just said there is no session, so every
 * further 401 in the next minute is the same question with the same answer.
 *
 * Time-boxed rather than a flag cleared only by markSessionRecovered(). A latch
 * that needs someone to remember to reset it is a latch that eventually is not
 * reset — and being stuck on "refused" would suppress the refresh that recovers
 * a session, which is a worse failure than the noise it prevents. A minute is
 * far longer than the sub-second loop this exists to kill.
 */
let refreshRefusedUntil = 0;
const REFRESH_REFUSED_QUIET_MS = 60_000;

async function refreshSession(): Promise<RefreshOutcome> {
  // Signing out is the one thing a refresh must never undo. Two separate ways
  // it used to:
  //   1. The echo shortcut below answers "yes, you are signed in" from a
  //      timestamp alone, without asking the server — and re-sets the mr-auth
  //      hint cookie while doing it. Sign out, and the account poll's 401
  //      lands here milliseconds later and resurrects the flag.
  //   2. Even the real round-trip is wrong here: the backend's rotation grace
  //      window (fixed in backend migration 0110) would mint a fresh pair from
  //      the just-revoked token.
  // Either way the shopper is signed back in while the UI shows them signed
  // out, which is exactly the reported "logged out but my chat history is
  // still there". After a deliberate sign-out there is nothing to refresh.
  if (Date.now() - deliberateSignOutAt < SIGN_OUT_QUIET_MS) return 'refused';

  // Another tab refreshed a moment ago, so the cookies in this tab are already
  // fresh. Posting the spent token would only rotate it again for nothing.
  if (Date.now() - lastRefreshAt < REFRESH_ECHO_MS) {
    markAuthenticated();
    return 'refreshed';
  }

  // Already answered, and the answer does not change until someone signs in.
  if (Date.now() < refreshRefusedUntil) return 'refused';
  if (Date.now() < refreshBlockedUntil) return 'unavailable';

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          // Refresh token travels in the httpOnly cookie; empty JSON body.
          body: '{}',
        });
        if (res.ok) {
          markAuthenticated();
          announceRefresh();
          return 'refreshed' as const;
        }
        // 401/403 is the server stating there is no session to refresh. Any
        // other failure status is the server declining to answer the question
        // — a rate limit, an outage, a proxy — and says nothing about whether
        // this browser is signed in.
        if (res.status === 401 || res.status === 403) {
          refreshRefusedUntil = Date.now() + REFRESH_REFUSED_QUIET_MS;
          return 'refused' as const;
        }
        // Honour Retry-After when the server sent one; it knows better than a
        // fixed constant how long its own limit lasts.
        const retryAfter = Number(res.headers.get('retry-after'));
        refreshBlockedUntil =
          Date.now() +
          (Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 5 * 60_000)
            : REFRESH_UNAVAILABLE_COOLDOWN_MS);
        return 'unavailable' as const;
      } catch {
        // Network failure — the request never reached the server, so this is
        // emphatically not a refusal.
        refreshBlockedUntil = Date.now() + REFRESH_UNAVAILABLE_COOLDOWN_MS;
        return 'unavailable' as const;
      } finally {
        // Cleared synchronously. Concurrent callers have already joined by
        // awaiting this same promise; anyone arriving AFTER it settles must
        // start a fresh attempt, not inherit a stale verdict from a refresh
        // that has already finished.
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * True once the expiry handler has fired for the current dead session. Without
 * it every subsequent poll pushed /login again — a navigation per poll, which
 * looked exactly like the page reloading every second and left the storefront
 * unusable. Reset by markSessionRecovered() on the next successful auth.
 */
let sessionExpiryAnnounced = false;

/** Auth routes must never be redirected away from — that is the loop. */
function isOnAuthRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return /^\/(login|signup|forgot|reset-password)(\/|$|\?)/.test(
    window.location.pathname,
  );
}

/** Called after a successful sign-in/refresh so a later expiry announces again. */
export function markSessionRecovered(): void {
  sessionExpiryAnnounced = false;
  // A session exists again, so both refresh latches are stale: the refusal was
  // about the previous (absent) session, and the cooldown was about a server
  // that has evidently just answered us.
  refreshRefusedUntil = 0;
  refreshBlockedUntil = 0;
  // A new identity may be cleared later; this one is alive.
  identityClearedAnnouncedAt = 0;
  // The sign-out quiet window ENDS here, and forgetting this was a real bug.
  //
  // `deliberateSignOutAt` suppresses refreshes so a sign-out cannot be undone
  // by an in-flight 401. But nothing ever cleared it, so it also suppressed
  // refreshes for the first SIGN_OUT_QUIET_MS of the NEXT session. Sign out,
  // sign straight back in, and any authed request that 401s in that window got
  // no refresh — apiFetch then cleared the `mr-auth` flag, and the Edge proxy,
  // which gates /account on that flag alone, bounced the shopper it had just
  // let in back to /login. Reported as "im signed in and when i tap on profile
  // it redirects me to /login".
  //
  // This function is called on any successful authed response and after a
  // successful refresh — both are proof the session is alive, which is exactly
  // when suppressing refreshes stops being correct.
  deliberateSignOutAt = 0;
}

/**
 * Set when the shopper deliberately signs out.
 *
 * Signing out clears the cookies, and any authed request already in flight —
 * a poll, the support widget, the cart — then 401s and lands here. Without
 * this, a normal sign-out announced "Your session expired", which is both
 * wrong and slightly alarming: nothing expired, they left.
 */
let deliberateSignOutAt = 0;
const SIGN_OUT_QUIET_MS = 5_000;

export function markDeliberateSignOut(): void {
  deliberateSignOutAt = Date.now();
  sessionExpiryAnnounced = true;
  // There is definitively nothing to refresh now, and the quiet window is only
  // five seconds. Without this, every authed request that 401s after those five
  // seconds starts asking again.
  refreshRefusedUntil = Date.now() + REFRESH_REFUSED_QUIET_MS;
  // Nothing in this tab may claim a recent refresh any more, and neither may
  // anything arriving from another tab — see announceSignedOut().
  lastRefreshAt = 0;
  announceSignedOut();
}

/**
 * Same-tab "this browser is no longer signed in" signal.
 *
 * `useUser()` already listens for the `storage` event to drop its cached
 * identity — but **`storage` does not fire in the tab that made the change**,
 * only in the others. So the ONE tab where the session actually died was the
 * one tab that never invalidated. With `staleTime: 15 min` its `/auth/me`
 * query never refetched either, so `authUser` stayed populated and every
 * consumer went on believing the shopper was signed in.
 *
 * That is why an expired session still showed the previous account's full
 * support thread, with a working composer, on the login screen — the redirect
 * came from THIS handler while the widget's own identity was never touched.
 *
 * A DOM event rather than an import of the query client: `lib/api/client.ts`
 * is imported by the hooks, so depending on them here would be a cycle.
 */
export const IDENTITY_CLEARED_EVENT = 'mr-identity-cleared';

/**
 * Announced at most once per five seconds, and reset by markSessionRecovered().
 *
 * Listeners respond to this by dropping caches, and dropping a cache with a
 * mounted observer makes React Query refetch it at once. If that refetch is an
 * authed call it 401s, which lands back here — so an unguarded announcement is
 * a request loop with extra steps. The identity is already gone; announcing it
 * again a few milliseconds later cannot make it more gone.
 *
 * A window rather than a permanent flag, for the same reason as
 * refreshRefusedUntil: five seconds is three orders of magnitude longer than
 * the cascade this suppresses, and a guard that can get stuck on would silence
 * a real sign-out later in the tab's life.
 */
let identityClearedAnnouncedAt = 0;
const IDENTITY_CLEARED_QUIET_MS = 5_000;

function announceIdentityCleared(): void {
  if (typeof window === 'undefined') return;
  if (Date.now() - identityClearedAnnouncedAt < IDENTITY_CLEARED_QUIET_MS) return;
  identityClearedAnnouncedAt = Date.now();
  try {
    window.dispatchEvent(new Event(IDENTITY_CLEARED_EVENT));
  } catch {
    // A browser that refuses the event still has the cross-tab `storage`
    // path and the next natural refetch; this is a fast path, not the only one.
  }
}

function announceSessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (Date.now() - deliberateSignOutAt < SIGN_OUT_QUIET_MS) return;
  if (sessionExpiryAnnounced || isOnAuthRoute()) return;
  sessionExpiryAnnounced = true;
  onSessionExpired?.(window.location.pathname + window.location.search);
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean; _isRetry?: boolean },
): Promise<T> {
  const { auth = false, _isRetry = false, ...fetchInit } = init ?? {};

  const headers = new Headers(fetchInit.headers);
  // A multipart upload has to set its own Content-Type, because only the
  // browser knows the boundary string it generated. Forcing application/json
  // here makes the body unparseable at the other end, and the failure looks
  // like a rejected file rather than a broken header.
  if (!(fetchInit.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // credentials:'include' sends the httpOnly auth cookies (mr_access/mr_refresh)
  // on every request, including cross-subdomain to the API. No bearer token is
  // read from JS anymore — the browser attaches the cookie automatically.
  const res = await fetch(`${BASE}${path}`, {
    ...fetchInit,
    headers,
    credentials: 'include',
  });

  // Only attempt a cookie-based refresh for calls that expect a session.
  //
  // `!_isRetry` gates the REFRESH attempt only — deliberately not the clearing
  // below. A retried request that 401s again used to fall straight through to
  // the generic !res.ok branch, so the local auth state was never cleared and
  // the mr-auth hint cookie survived a session the server had already refused.
  // Anything reading that flag (the support widget's "does this person have an
  // account" veto, the Edge proxy) then kept treating a signed-out visitor as
  // signed in.
  if (res.status === 401 && auth) {
    const outcome = _isRetry ? 'refused' : await refreshSession();
    if (outcome === 'refreshed') {
      markSessionRecovered();
      return apiFetch<T>(path, { ...init, _isRetry: true });
    }
    // "We could not check" is not "you are signed out", and treating it as one
    // is the whole bug. A 429 on /auth/refresh used to land here, clear the
    // mr-auth hint, and dispatch IDENTITY_CLEARED — which signed out a shopper
    // whose httpOnly cookies were perfectly valid, showed SIGN IN in the header
    // while /account still rendered their profile from the same session, and
    // could not recover until the tab was reloaded (2026-08-01).
    //
    // Throwing a distinct status matters: useSessionState only fails closed on
    // a settled 401, so a 503 leaves the session 'unknown' and lets the hint
    // cookie vouch — which is exactly the honest answer here.
    if (outcome === 'unavailable') {
      throw {
        status: 503,
        message: 'Could not verify your session just now',
        error: 'session_check_unavailable',
      } as ApiError;
    }
    // Was there ever a session to expire? Read this BEFORE clearing the flag,
    // or the answer is always "no".
    //
    // A shopper who is simply browsing has no session, and background calls
    // that expect one (the support widget asking who you are, the account
    // poll) 401 for them constantly and correctly. Announcing expiry for those
    // threw a guest onto the login page from a public product or brand page —
    // an interruption for someone who was never signed in and had not asked
    // for anything, which is traffic walking out of the shop.
    const hadSession = isAuthenticated();
    clearAuthFlag();
    clearSession();
    // Unconditional, and BEFORE the expiry announcement: every consumer in
    // THIS tab must drop the previous identity even when `hadSession` was
    // already false, or a component holding a cached profile keeps rendering
    // it. The redirect below is cosmetic by comparison — this is the line
    // that stops the old account's data staying on screen.
    announceIdentityCleared();
    if (hadSession) {
      // Announce at most once so polling callers cannot each fire a redirect.
      announceSessionExpired();
    }
    throw { status: 401, message: 'Session expired' } as ApiError;
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      // ignore parse failure
    }
    const err: ApiError = {
      status: res.status,
      message: (body['message'] as string) ?? res.statusText,
      error: body['error'] as string | undefined,
    };
    throw err;
  }

  // Any successful authenticated call means the session is alive again, so a
  // future expiry is allowed to announce itself once more. Self-healing, rather
  // than relying on every sign-in path to remember to reset the flag.
  if (auth) {
    markSessionRecovered();
    // Re-assert the `mr-auth` hint, and note this is NOT redundant.
    //
    // The hint is only ever SET on sign-in and after a successful refresh, but
    // it is CLEARED by any 401 on an authed request. So a single spurious 401
    // — a request killed by a navigation, a blip, a poll racing a rotation —
    // removed it permanently, and nothing restored it until the next sign-in.
    //
    // That is not cosmetic, because the Edge proxy (proxy.ts) gates /account
    // and /orders on this flag ALONE: it runs on a different host from the API
    // and never sees the httpOnly cookie, so it has nothing else to read. The
    // shopper stayed genuinely signed in — avatar, chat, everything — while
    // every proxy-guarded page bounced them to /login, forever. Reported as
    // "im still logged in and it redirects me to /login although i can see my
    // profile photo in the mobile bottom menu and chat clearly treats me as
    // logged in".
    //
    // A response the server authenticated is proof the session is alive, which
    // is exactly when the hint should be true. Setting it here makes the flag
    // self-correcting instead of a one-shot that can be lost for good.
    markAuthenticated();
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/**
 * Bare HTTP reason phrases, which some backend paths send as the whole message.
 * Printing "Unprocessable Entity" at a shopper tells them nothing about what to
 * do next, so it counts as no message and the caller's own sentence wins.
 */
const HTTP_REASON_PHRASES = new Set([
  'bad request',
  'unauthorized',
  'forbidden',
  'not found',
  'conflict',
  'unprocessable entity',
  'too many requests',
  'internal server error',
  'service unavailable',
]);

function usefulSentence(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return HTTP_REASON_PHRASES.has(trimmed.toLowerCase()) ? null : trimmed;
}

/**
 * A readable sentence from any API error. THE one place that reads `message`.
 *
 * The backend's 422 body carries `message` as an ARRAY of `{ field, issue }`
 * (class-validator) or of plain strings (Zod), so `String(err.message)` rendered
 * "[object Object]" on the checkout page — the customer was told nothing at all
 * about why their order would not go through.
 *
 * The sign-up page then hit the same shape from the other direction: it called
 * `.trim()` on the array, which threw INSIDE its catch block, so the error
 * handler died before it could display anything. A page that shows nothing at
 * all is worse than one that shows a clumsy message, and both are avoidable by
 * never touching `message` outside this function.
 *
 * Total: this never throws, and never returns an empty string.
 */
export function formatApiError(err: unknown, fallback: string): string {
  try {
    return formatApiErrorUnsafe(err, fallback);
  } catch {
    // A shape nobody anticipated is still not a reason to show a blank screen.
    return fallback;
  }
}

function formatApiErrorUnsafe(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const message = (err as { message?: unknown }).message;

  if (typeof message === 'string') {
    const useful = usefulSentence(message);
    if (useful) return useful;
    return fallback;
  }

  if (Array.isArray(message)) {
    const parts = message
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const e = entry as { field?: unknown; issue?: unknown; message?: unknown };
          const field = typeof e.field === 'string' ? e.field : '';
          const issue =
            typeof e.issue === 'string'
              ? e.issue
              : typeof e.message === 'string'
                ? e.message
                : '';
          if (field && issue) return `${field}: ${issue}`;
          return issue || field;
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('. ');
  }

  return fallback;
}

import { markAuthenticated, clearAuthFlag } from '@/lib/auth/tokens';
import { clearSession } from '@/lib/session';

export interface ApiError {
  status: number;
  message: string;
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
let refreshInFlight: Promise<boolean> | null = null;

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

function announceRefresh() {
  lastRefreshAt = Date.now();
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.postMessage({ kind: 'refreshed', at: lastRefreshAt });
    ch.close();
  } catch {
    // A browser that refuses the channel simply falls back to the server's
    // grace window.
  }
}

if (typeof BroadcastChannel !== 'undefined') {
  try {
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.onmessage = (e: MessageEvent<{ kind?: string; at?: number }>) => {
      if (e.data?.kind === 'refreshed') {
        lastRefreshAt = Math.max(lastRefreshAt, e.data.at ?? Date.now());
        markAuthenticated();
      }
    };
  } catch {
    // Non-fatal — see above.
  }
}

async function refreshSession(): Promise<boolean> {
  // Another tab refreshed a moment ago, so the cookies in this tab are already
  // fresh. Posting the spent token would only rotate it again for nothing.
  if (Date.now() - lastRefreshAt < REFRESH_ECHO_MS) {
    markAuthenticated();
    return true;
  }

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
          return true;
        }
        return false;
      } catch {
        return false;
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
}

function announceSessionExpired(): void {
  if (typeof window === 'undefined') return;
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
  if (res.status === 401 && !_isRetry && auth) {
    if (await refreshSession()) {
      markSessionRecovered();
      return apiFetch<T>(path, { ...init, _isRetry: true });
    }
    // Refresh failed — clear the UI hint + session, and announce expiry at most
    // once so polling callers cannot each trigger their own redirect.
    clearAuthFlag();
    clearSession();
    announceSessionExpired();
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
  if (auth) markSessionRecovered();

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/**
 * A readable sentence from any API error.
 *
 * The backend's 422 body carries `message` as an ARRAY of `{ field, issue }`
 * (class-validator) or of plain strings (Zod), so `String(err.message)` rendered
 * "[object Object]" on the checkout page — the customer was told nothing at all
 * about why their order would not go through.
 */
export function formatApiError(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const message = (err as { message?: unknown }).message;

  if (typeof message === 'string' && message.trim()) return message;

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

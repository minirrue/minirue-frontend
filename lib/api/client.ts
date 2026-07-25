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

async function refreshSession(): Promise<boolean> {
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
  headers.set('Content-Type', 'application/json');

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

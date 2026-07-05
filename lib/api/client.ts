import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/auth/tokens';
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

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean; _isRetry?: boolean },
): Promise<T> {
  const { auth = false, _isRetry = false, ...fetchInit } = init ?? {};

  const headers = new Headers(fetchInit.headers);
  headers.set('Content-Type', 'application/json');

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(`${BASE}${path}`, { ...fetchInit, headers });

  if (res.status === 401 && !_isRetry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const pair = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
          setTokens(pair.accessToken, pair.refreshToken);
          return apiFetch<T>(path, { ...init, _isRetry: true });
        }
      } catch {
        // refresh network failure — fall through to throw
      }
      // Refresh failed — clear stale tokens but DO NOT auto-redirect.
      // Calling code (or page-level guards) decide what to do with a 401.
      clearTokens();
      clearSession();
      if (onSessionExpired && typeof window !== 'undefined') {
        onSessionExpired(window.location.pathname + window.location.search);
      }
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

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

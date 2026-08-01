import { apiFetch } from './client';
import { markAuthenticated } from '@/lib/auth/tokens';
import { parseAuthUser } from '@/lib/auth/session-role';
import type {
  AuthSuccessResponse,
  MeResponse,
  TokenPair,
  UserProfile,
} from '@/lib/auth/types';

export type { AuthSuccessResponse as AuthResponse, MeResponse } from '@/lib/auth/types';

function createIdempotencyKey(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

/**
 * `rememberMe` decides how long the session survives a browser restart —
 * the full configured window when ticked, one day when not. The checkbox on
 * the sign-in page existed for a long time without being sent anywhere;
 * backend 0.52.0 is what made it mean something.
 */
export async function apiLogin(
  email: string,
  password: string,
  rememberMe = false,
): Promise<AuthSuccessResponse> {
  const data = await apiFetch<TokenPair>('/auth/login', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('login') },
    body: JSON.stringify({ email, password, rememberMe }),
  });
  // Backend has set the httpOnly token cookies; just flip the UI hint.
  markAuthenticated();
  const user = await resolveUserAfterAuth(data, email);
  return { ...data, user };
}

/**
 * The user, read from the access token the server just issued.
 *
 * Register and login return tokens but no profile, so both used to finish with
 * `await apiMe()` — an extra round trip, on the critical path, whose failure
 * threw away a sign-up that had ALREADY SUCCEEDED. That is precisely what the
 * owner hit: the account was created (201, customer.provisioned in the logs),
 * the very next /auth/me came back 429, and the storefront told them
 * "Something went wrong. Please try again." Retrying then said the account
 * already existed (2026-08-01).
 *
 * The token in hand carries `sub`, `role` and `email` already, so the identity
 * is knowable without asking anyone. Decoding it is safe here because we are
 * reading OUR OWN freshly-minted token for display purposes only — nothing is
 * authorised on the strength of these claims; every request still presents the
 * httpOnly cookie and the server still checks the signature.
 */
function userFromAccessToken(accessToken: string, fallbackEmail: string): UserProfile | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as {
      sub?: string;
      role?: string;
      email?: string;
      name?: string;
    };
    if (!claims.sub || !claims.role) return null;
    return parseAuthUser({
      userId: claims.sub,
      role: claims.role,
      email: claims.email ?? fallbackEmail,
      name: claims.name,
    });
  } catch {
    return null;
  }
}

/**
 * `apiMe()`, but a failure never costs us the sign-in we just completed.
 *
 * Falls back to the token's own claims, and only gives up if the token cannot
 * be read either — at which point there genuinely is nothing to show.
 */
async function resolveUserAfterAuth(
  tokens: TokenPair,
  fallbackEmail: string,
): Promise<UserProfile> {
  try {
    return await apiMe();
  } catch (err) {
    const fromToken = userFromAccessToken(tokens.accessToken, fallbackEmail);
    if (fromToken) return fromToken;
    throw err;
  }
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** E.164, dial code included. */
  phone: string;
}

export async function apiRegister(
  input: RegisterInput,
): Promise<AuthSuccessResponse> {
  const { firstName, lastName, email, password, phone } = input;
  const data = await apiFetch<TokenPair>('/auth/register', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('register') },
    body: JSON.stringify({ firstName, lastName, email, password, phone }),
  });
  // Backend has set the httpOnly token cookies; just flip the UI hint.
  markAuthenticated();
  const user = await resolveUserAfterAuth(data, email);
  return { ...data, user };
}

export async function apiRefresh(): Promise<void> {
  // Refresh token travels in the httpOnly cookie; the backend rotates both
  // cookies. Empty JSON body keeps the DTO validator happy.
  await apiFetch<AuthSuccessResponse>('/auth/refresh', {
    method: 'POST',
    body: '{}',
  });
  markAuthenticated();
}

export async function apiLogout(): Promise<void> {
  // Backend reads the refresh token from the httpOnly cookie and clears both.
  await apiFetch<void>('/auth/logout', {
    method: 'POST',
    auth: true,
    body: '{}',
  });
}

export async function apiForgotPassword(email: string): Promise<void> {
  await apiFetch<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiResetPassword(token: string, password: string): Promise<void> {
  await apiFetch<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword: password }),
  });
}

export async function apiMe(): Promise<MeResponse> {
  const me = await apiFetch<MeResponse>('/auth/me', { auth: true });
  return parseAuthUser(me);
}

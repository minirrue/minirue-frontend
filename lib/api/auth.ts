import { apiFetch } from './client';
import { markAuthenticated } from '@/lib/auth/tokens';
import { parseAuthUser } from '@/lib/auth/session-role';
import type { AuthSuccessResponse, MeResponse, TokenPair } from '@/lib/auth/types';

export type { AuthSuccessResponse as AuthResponse, MeResponse } from '@/lib/auth/types';

function createIdempotencyKey(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export async function apiLogin(email: string, password: string): Promise<AuthSuccessResponse> {
  const data = await apiFetch<TokenPair>('/auth/login', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('login') },
    body: JSON.stringify({ email, password }),
  });
  // Backend has set the httpOnly token cookies; just flip the UI hint.
  markAuthenticated();
  const user = await apiMe();
  return { ...data, user };
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
  const user = await apiMe();
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

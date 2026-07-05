import { apiFetch } from './client';
import { setTokens } from '@/lib/auth/tokens';
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
  setTokens(data.accessToken, data.refreshToken);
  const user = await apiMe();
  return { ...data, user };
}

export async function apiRegister(
  name: string,
  email: string,
  password: string,
): Promise<AuthSuccessResponse> {
  const data = await apiFetch<TokenPair>('/auth/register', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('register') },
    body: JSON.stringify({ name, email, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  const user = await apiMe();
  return { ...data, user };
}

export async function apiRefresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const pair = await apiFetch<AuthSuccessResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  setTokens(pair.accessToken, pair.refreshToken);
  return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await apiFetch<void>('/auth/logout', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ refreshToken }),
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

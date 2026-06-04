import { apiFetch } from './client';
import { setTokens } from '@/lib/auth/tokens';

// Backend TokenPairDto — what login/register/refresh return
interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface MeResponse {
  userId: string;
  role: string;
  email: string;
}

// Full auth response with user details (assembled from token pair + /me)
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    role: string;
  };
}

function createIdempotencyKey(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

async function fetchUserAndAssemble(pair: TokenPairDto, firstName: string): Promise<AuthResponse> {
  // Temporarily set tokens so the /auth/me call can use auth: true
  setTokens(pair.accessToken, pair.refreshToken);
  const me = await apiFetch<MeResponse>('/auth/me', { auth: true });
  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    user: {
      id: me.userId,
      email: me.email,
      firstName,
      role: me.role,
    },
  };
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const pair = await apiFetch<TokenPairDto>('/auth/login', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('login') },
    body: JSON.stringify({ email, password }),
  });
  return fetchUserAndAssemble(pair, email.split('@')[0]);
}

export async function apiRegister(
  firstName: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const pair = await apiFetch<TokenPairDto>('/auth/register', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('register') },
    body: JSON.stringify({ firstName, email, password }),
  });
  return fetchUserAndAssemble(pair, firstName);
}

export async function apiRefresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const pair = await apiFetch<TokenPairDto>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
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
  return apiFetch<MeResponse>('/auth/me', { auth: true });
}

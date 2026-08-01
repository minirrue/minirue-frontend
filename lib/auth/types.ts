/** Mirrors `knowledge/specs/001-auth-backend/contracts/auth-api.yaml` */

import type { Role } from './role';

export type { Role } from './role';

export interface UserProfile {
  userId: string;
  role: Role;
  email: string;
  name?: string;
}

/**
 * Retained only for the dashboard's "sign in as" flow, which still mints a
 * short-lived token rather than a cookie. Nothing in the storefront issues or
 * reads one any more.
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * What a successful sign-in or sign-up gives the client.
 *
 * No longer extends TokenPair. Better Auth's session lives entirely in an
 * httpOnly cookie — there is no access or refresh token for a caller to hold,
 * and pretending otherwise would mean returning empty strings that look like
 * credentials. `user` is the only field any call site ever read.
 */
export interface AuthSuccessResponse {
  user: UserProfile;
}

export type MeResponse = UserProfile;

import { apiFetch } from './client';
import { markAuthenticated } from '@/lib/auth/tokens';
import { parseAuthUser } from '@/lib/auth/session-role';
import type { AuthSuccessResponse, MeResponse, UserProfile } from '@/lib/auth/types';

export type { AuthSuccessResponse as AuthResponse, MeResponse } from '@/lib/auth/types';

/**
 * The storefront's auth calls, now served by Better Auth.
 *
 * Every function here keeps the name, the arguments and the return shape it had
 * before, because about thirty files call them and none of those files care
 * where a session comes from. The migration changes where identity is PROVEN,
 * not what it looks like once proven — the same approach that let the backend
 * swap its guard without touching the forty-three files that read `req.user`.
 *
 * What genuinely changed, and is worth knowing when reading call sites:
 *
 *   - There are no tokens any more. The old stack returned an access/refresh
 *     pair in the body AND set cookies; Better Auth sets an httpOnly cookie and
 *     that is the whole session. `AuthSuccessResponse.user` is the only field
 *     that ever mattered to a caller, and it is unchanged.
 *   - There is no `/auth/refresh` to call. Better Auth extends a session on its
 *     own as it is used (`updateAge`), so the client has nothing to drive.
 *     `apiRefresh` survives as a session CHECK for the one caller that needs to
 *     ask "am I still signed in" — see below.
 */

/** Better Auth's user shape -> ours. It calls the id `id`; we call it `userId`. */
function toUserProfile(user: {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
}): UserProfile {
  return parseAuthUser({
    userId: user.id,
    role: user.role ?? 'CUSTOMER',
    email: user.email,
    name: user.name ?? undefined,
  });
}

interface BetterAuthSignInResponse {
  token?: string;
  user: { id: string; email: string; name?: string | null; role?: string | null };
}

/**
 * `rememberMe` still means what it always did — the session outlives the
 * browser being closed. Better Auth takes it on the sign-in body directly.
 */
export async function apiLogin(
  email: string,
  password: string,
  rememberMe = false,
): Promise<AuthSuccessResponse> {
  const data = await apiFetch<BetterAuthSignInResponse>('/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  });
  // The httpOnly session cookie is already set by the response; this only flips
  // the client-visible hint the Edge proxy and the UI read.
  markAuthenticated();
  return { user: toUserProfile(data.user) };
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
  const { firstName, lastName, email, password } = input;
  /**
   * Better Auth's sign-up takes a single `name`, so the two fields are joined
   * here exactly as the old backend joined them for `users.name`. The customer
   * profile's separate first/last names are filled by the backend's
   * `user.create.after` hook, which splits this back apart the same way the old
   * register endpoint did.
   */
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();

  const data = await apiFetch<BetterAuthSignInResponse>('/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  markAuthenticated();
  return { user: toUserProfile(data.user) };
}

/**
 * "Is this browser still signed in?" — no longer a token rotation.
 *
 * Better Auth extends a session as it is used, so there is nothing for a client
 * to refresh. The one thing `apiRefresh` was ever used for that still makes
 * sense is asking the server whether the session is alive, which is what
 * `client.ts` does with it on a 401. Hitting `get-session` answers exactly that
 * and costs one indexed lookup.
 *
 * Throws when there is no session, matching the old contract — `client.ts`
 * distinguishes a REFUSAL from a failure-to-ask by status code, and a 401 here
 * is a refusal.
 */
export async function apiRefresh(): Promise<void> {
  const session = await apiFetch<{ user?: unknown } | null>('/auth/get-session');
  if (!session?.user) {
    throw { status: 401, message: 'No session' };
  }
  markAuthenticated();
}

export async function apiLogout(): Promise<void> {
  await apiFetch<void>('/auth/sign-out', {
    method: 'POST',
    auth: true,
    body: '{}',
  });
}

export async function apiForgotPassword(email: string): Promise<void> {
  /**
   * `request-password-reset`, not `forget-password`.
   *
   * Better Auth's docs still name the latter and 1.6 does not register it —
   * it 404s. A 404 on this route is invisible to the shopper, because the
   * flow deliberately says "if that email is registered, a link has been
   * sent" whether or not it was: they would simply wait for an email that was
   * never requested. Verified against the running server rather than the docs.
   */
  await apiFetch<void>('/auth/request-password-reset', {
    method: 'POST',
    // Better Auth appends its own token to this path when it builds the link.
    body: JSON.stringify({ email, redirectTo: '/reset-password' }),
  });
}

export async function apiResetPassword(
  token: string,
  password: string,
): Promise<void> {
  await apiFetch<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword: password }),
  });
}

/**
 * Who is signed in.
 *
 * `get-session` returns `{ session, user }` and — importantly — returns 200
 * with a null body for a signed-out visitor rather than 401. The old `/auth/me`
 * 401ed, and `client.ts` leans on that distinction hard: a settled 401 is what
 * makes `useSessionState` fail closed. So an empty session is converted into
 * the 401 the rest of the app already knows how to reason about, rather than
 * teaching every consumer a second way to be signed out.
 */
export async function apiMe(): Promise<MeResponse> {
  const session = await apiFetch<{
    user?: { id: string; email: string; name?: string | null; role?: string | null };
  } | null>('/auth/get-session', { auth: true });

  if (!session?.user) {
    throw { status: 401, message: 'Session expired' };
  }
  return toUserProfile(session.user);
}

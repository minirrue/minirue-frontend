import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import {
  apiLogin,
  apiRegister,
  apiLogout,
  apiMe,
  type AuthResponse,
  type RegisterInput,
} from '@/lib/api/auth';
import { clearAuthFlag } from '@/lib/auth/tokens';
import { markDeliberateSignOut } from '@/lib/api/client';
import { setSession, clearSession } from '@/lib/session';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import { CUSTOMER_ADDRESSES_KEY, CUSTOMER_PROFILE_KEY } from '@/lib/hooks/use-customer';

const AUTH_QUERY_KEY = ['auth'];
const ME_QUERY_KEY = ['auth', 'me'];

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      password,
      rememberMe,
    }: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }) => {
      return apiLogin(email, password, rememberMe === true);
    },
    onSuccess: async (data: AuthResponse) => {
      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name ?? data.user.email.split('@')[0],
        role: data.user.role,
        createdAt: Date.now(),
      });
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      queryClient.invalidateQueries({ queryKey: CUSTOMER_PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
      await syncCartAfterAuth();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterInput) => apiRegister(input),
    onSuccess: async (data: AuthResponse) => {
      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name ?? '',
        role: data.user.role,
        createdAt: Date.now(),
      });
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      queryClient.invalidateQueries({ queryKey: CUSTOMER_PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
      await syncCartAfterAuth();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Refresh token is in the httpOnly cookie; backend reads it and clears
      // both cookies. Best-effort — a failed round-trip must still sign out
      // locally (handled in onSettled).
      await apiLogout().catch(() => undefined);
    },
    onSettled: () => {
      // §25 Rule 4 + US-SHOPPER-IAM-003 / US-ADMIN-IAM-007 / US-COLLABORATOR-IAM-009:
      // clearTokens() removes the `mr-access-token` / `mr-refresh-token` localStorage entries
      // AND the `mr-auth` cookie (the one the Edge proxy reads on every navigation). Before
      // this fix, the cookie survived sign-out and the proxy let the user back into protected
      // routes — the 2026-07-07 v5 falsification root cause. clearSession() removes the
      // `mr-session` localStorage key that `Header.tsx` reads to render the account-menu
      // greeting (closes the §26 Rule 4 parallel-second-implementation gap where `Header.tsx`
      // had its OWN direct sign-out path that cleared these but `AccountLayoutClient.tsx` did
      // not). Order: clearAuthFlag BEFORE removeQueries so a re-render from a
      // still-cached query cannot re-hydrate as logged-in.
      //
      // onSettled (not onSuccess) — the user clicked "Sign out"; the spec is about
      // the user-perceived post-state, not whether the server round-trip succeeded.
      // A 5xx or network error from POST /v1/auth/logout must NOT leave the user
      // signed in — the UI hint + session must be cleared regardless (and the
      // backend also clears the httpOnly cookies on its side). The e2e "defense
      // in depth" test in `e2e/auth/logout.spec.ts` exercises this.
      // Before clearing anything: an authed request already in flight will
      // 401 the moment the cookies go, and the expiry handler would announce
      // "Your session expired" for what is simply someone leaving.
      markDeliberateSignOut();
      clearAuthFlag();
      clearSession();
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      queryClient.removeQueries({ queryKey: CUSTOMER_PROFILE_KEY });
      queryClient.removeQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
    },
  });
}

export function useUser() {
  return useClientQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: apiMe,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });
}

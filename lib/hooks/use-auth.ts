import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { apiLogin, apiRegister, apiLogout, apiMe, type AuthResponse } from '@/lib/api/auth';
import { getRefreshToken, clearTokens } from '@/lib/auth/tokens';
import { setSession, clearSession } from '@/lib/session';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import { CUSTOMER_ADDRESSES_KEY, CUSTOMER_PROFILE_KEY } from '@/lib/hooks/use-customer';

const AUTH_QUERY_KEY = ['auth'];
const ME_QUERY_KEY = ['auth', 'me'];

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return apiLogin(email, password);
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
    mutationFn: async ({
      name,
      email,
      password,
    }: {
      name: string;
      email: string;
      password: string;
    }) => {
      return apiRegister(name, email, password);
    },
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
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
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
      // not). Order: clearTokens BEFORE removeQueries so a re-render from a still-cached
      // query cannot re-hydrate from stale tokens.
      //
      // onSettled (not onSuccess) — the user clicked "Sign out"; the spec is about
      // the user-perceived post-state, not whether the server round-trip succeeded.
      // A 5xx or network error from POST /v1/auth/logout must NOT leave the user
      // signed in — the cookie + tokens + session must be cleared regardless. The
      // e2e "defense in depth" test in `e2e/auth/logout.spec.ts` exercises this.
      clearTokens();
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

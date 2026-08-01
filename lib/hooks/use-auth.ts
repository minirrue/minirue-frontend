'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
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
import { markDeliberateSignOut, IDENTITY_CLEARED_EVENT } from '@/lib/api/client';
import { setSession, clearSession } from '@/lib/session';
import { clearGuestSupport } from '@/lib/support/session';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import { CUSTOMER_ADDRESSES_KEY, CUSTOMER_PROFILE_KEY } from '@/lib/hooks/use-customer';

const ME_QUERY_KEY = ['auth', 'me'];

/**
 * Every React Query key prefix that belongs to a PERSON rather than to the shop.
 *
 * Sign-out used to remove four exact keys — `['auth']`, `['auth','me']`,
 * `['customer','me']`, `['customer','addresses']` — and nothing else. React
 * Query serves a cached result synchronously on mount and only then refetches,
 * so everything NOT in that list stayed on screen as the previous account's
 * data: the order history and any open order detail, the saved-products list,
 * the cart, and "have you bought this, may you review it". Sign out and click
 * Orders and you are reading the account you just left; sign in as somebody
 * else and you are reading it as them, until each query happens to refetch.
 *
 * Prefixes, not exact keys, because React Query matches by prefix: `['order']`
 * covers `['order', id]` for every order that was ever opened, and
 * `['customer']` covers the wishlist's two keys as well as profile/addresses.
 *
 * `['catalog']` and `['storefront']` are deliberately NOT here. They are the
 * public shop — products, categories, chrome, the home page — identical for
 * everyone signed in or out. queryClient.clear() would take them too and put
 * a skeleton flash on the page the shopper lands on after signing out, for no
 * privacy gain at all.
 */
const IDENTITY_QUERY_PREFIXES: readonly (readonly unknown[])[] = [
  ['auth'],
  ['customer'],
  ['orders'],
  ['order'],
  ['cart'],
  ['reviews'],
];

/**
 * Drops every cache that belongs to whoever was signed in a moment ago.
 *
 * Called on sign-out AND on sign-in. Sign-in matters just as much: a shopper
 * whose session died without them pressing Sign out never runs the sign-out
 * path at all, so signing in as somebody else on that same tab inherited the
 * previous person's orders, saved products and cart straight out of the cache.
 * `invalidateQueries` is not enough — it marks data stale but keeps serving it
 * until the refetch lands, which is exactly the window the owner keeps seeing.
 */
function clearIdentityCaches(queryClient: QueryClient): void {
  for (const queryKey of IDENTITY_QUERY_PREFIXES) {
    queryClient.removeQueries({ queryKey: queryKey as unknown[] });
  }
}

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
      // Before anything is written back: whatever is in the cache belongs to
      // the previous occupant of this tab, not to the person who just signed in.
      clearIdentityCaches(queryClient);
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
      clearIdentityCaches(queryClient);
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
      // Belt and braces alongside SupportWidget's own identity-transition reset
      // (which depends on useUser() actually invalidating): the owner asked
      // that logging out clear the support widget's device-level guest token
      // too, not just the tab's in-memory state.
      clearGuestSupport();
      // Every identity-bound cache, not the four keys this used to name —
      // see IDENTITY_QUERY_PREFIXES.
      clearIdentityCaches(queryClient);
    },
  });
}

export function useUser() {
  const queryClient = useQueryClient();

  // Cross-tab sign-out: `clearSession()` (useLogout's onSettled, and
  // apiFetch's 401 handler on a dead session) always removes the
  // `mr-session` localStorage key, in THIS tab. A native `storage` event
  // fires in every OTHER tab when that happens — for free, no BroadcastChannel
  // needed — but nothing was listening, so a second tab kept whatever it had
  // last fetched (see the `isError` note below) until it happened to refetch
  // on its own. Backstop: force this tab's cached "who am I" to be re-fetched
  // the moment another tab signs the browser out.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'mr-session' && e.newValue == null) {
        clearIdentityCaches(queryClient);
      }
    }
    /**
     * The SAME-tab counterpart, and the one that was missing.
     *
     * `storage` fires in every tab EXCEPT the one that wrote the change, so
     * the single tab where the session actually died was the only tab that
     * never invalidated. `useUser`'s 15-minute `staleTime` meant it never
     * refetched on its own either, so `authUser` stayed populated and the
     * support widget kept the previous account's whole thread on screen —
     * with a live composer — on the session-expired login page.
     *
     * `apiFetch` dispatches this the moment it clears auth state on a 401.
     */
    function onIdentityCleared() {
      // Every identity cache EXCEPT ['auth'], and that exception is the fix for
      // a runaway request loop, not a nicety.
      //
      // apiFetch dispatches this event from inside its own 401 handler, and
      // `removeQueries(['auth'])` on a query that still has a mounted observer
      // makes React Query refetch it IMMEDIATELY. That refetch is /auth/me, it
      // 401s for exactly the same reason as the one that got us here, and it
      // dispatches the event again: ~12 requests a second, forever, for every
      // signed-out visitor on the site. It burned the rate limit, so the very
      // next real request — the /auth/me straight after a successful sign-up —
      // came back 429 and the storefront said "something went wrong" about an
      // account it had just created (2026-08-01; 231 requests in one tab).
      //
      // Removing it is not needed anyway. useUser() already returns
      // `data: undefined` whenever the query is in error, and useSessionState
      // latches `ended` off this same event, so no consumer can still be
      // reading the old identity. The 401 is the signal; the refetch only ever
      // re-asked a question that had just been answered.
      for (const queryKey of IDENTITY_QUERY_PREFIXES) {
        if (queryKey[0] === 'auth') continue;
        queryClient.removeQueries({ queryKey: queryKey as unknown[] });
      }
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener(IDENTITY_CLEARED_EVENT, onIdentityCleared);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(IDENTITY_CLEARED_EVENT, onIdentityCleared);
    };
  }, [queryClient]);

  const query = useClientQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: apiMe,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  // React Query does NOT reset `data` to undefined when a background refetch
  // fails — a query that once succeeded keeps returning its last-known-good
  // `data` alongside `isError: true` / a populated `error`. A session that
  // expires (or is revoked) without the user clicking "Sign out" never runs
  // useLogout, so nothing ever removes this query; the next background poll's
  // 401 flips `isError` but `authUser` (every caller that reads `data` alone —
  // this is what SupportWidget did) kept reporting the OLD signed-in user
  // indefinitely, for the rest of the 15-minute staleTime and beyond. Any
  // caller of useUser() gets the corrected contract here, once, rather than
  // requiring every consumer to remember to also check `isError`.
  if (query.isError) {
    return { ...query, data: undefined } as typeof query;
  }
  return query;
}

'use client';

import React from 'react';
import { useUser } from '@/lib/hooks/use-auth';
import { isAuthenticated } from '@/lib/auth/tokens';
import { IDENTITY_CLEARED_EVENT } from '@/lib/api/client';
import type { MeResponse } from '@/lib/api/auth';

/**
 * THE answer to "is this browser signed in", for every consumer.
 *
 * Full trace of what auth state exists and how it disagrees:
 * `docs/superpowers/runbooks/auth-state-map.md`.
 *
 * This hook exists because the question had FIVE different implementations —
 * SupportWidget's three-flag version (correct), Header's (`isError ? null :
 * localStorage`, fails closed on a blip), MobileBottomNav's (a localStorage
 * snapshot nothing revokes), MobileBottomNav's OTHER one two lines away
 * (`!!authUser`), and checkout's (the forgeable hint cookie, alone). Each was
 * written for one screen and each was wrong in a different direction, and every
 * auth incident on 2026-07-31 was two of them disagreeing.
 *
 * The rules below are not new. They are the ones SupportWidget already
 * encoded, each one paid for by a production report, moved somewhere every
 * consumer can read them.
 */
export type SessionStatus =
  /** `/auth/me` returned a user, or did earlier in this tab and nothing has revoked it since. */
  | 'signed-in'
  /** Settled: a 401, or a local sign-out. Fail closed HERE and only here. */
  | 'signed-out'
  /** We have not heard back yet. NOT a synonym for either of the others. */
  | 'unknown';

export interface SessionState {
  status: SessionStatus;
  /**
   * Convenience booleans so call sites read as prose. Note there is no
   * `isSignedOut = !isSignedIn` — that collapse is the bug this hook exists to
   * prevent, so both are spelled out and neither is the negation of the other.
   */
  isSignedIn: boolean;
  isSignedOut: boolean;
  /**
   * The live user from `/auth/me`, or `undefined`. Deliberately undefined
   * whenever the query has no user, EVEN when `status` is 'signed-in' off the
   * back of `sessionProven` or the hint cookie — those prove a session exists,
   * they do not produce a profile. Render a name from this only when it is
   * present; never infer "signed out" from its absence.
   */
  user: MeResponse | undefined;
}

export function useSessionState(): SessionState {
  const { data: authUser, isLoading, isError, error } = useUser();

  /**
   * Did the SERVER actually say no, or did we just fail to ask?
   *
   * `apiFetch` only throws 401 for `/auth/me` once a cookie refresh has already
   * been tried and failed, so a 401 here is a settled "this browser has no
   * session". Anything else — the API unreachable, a 5xx, a request killed by a
   * navigation — is "we could not check", which must NOT be treated as a
   * sign-out. `useUser` is `retry: false` with a 15-minute staleTime, so one
   * unreachable call used to blank a real session for a quarter of an hour and
   * tell a signed-in customer to sign in. Reading `isError` instead of the
   * status code is precisely that bug, and Header.tsx had it.
   */
  const authDenied =
    isError && (error as { status?: number } | null | undefined)?.status === 401;

  /**
   * "A real session has been PROVEN in this tab, and nothing has revoked it
   * since." The only signal here a visitor cannot manufacture: set exclusively
   * by an `/auth/me` that actually returned a user.
   *
   * Crucially NOT cleared by `authUser` merely going undefined — that happens
   * on any transient failure too. Cleared only by a settled 401 or by
   * IDENTITY_CLEARED_EVENT.
   *
   * And "this browser's session has definitively ENDED" — `ended` — which is
   * distinct from `!proven`, which only means "not proven yet". Without the
   * distinction, consumers stick on their loading state forever: signing out
   * REMOVES the `/auth/me` query, so its observer immediately refetches and
   * `isLoading` goes true again — possibly forever on a page that is navigating
   * to /login. Owner: "its stale on checking your account it must say you are
   * not logged in".
   *
   * Latched DURING RENDER rather than in an effect. This is React's documented
   * "adjusting state when a prop changes" pattern: React re-runs the component
   * immediately, before committing or painting, so no cascading render and no
   * frame where a consumer sees the stale latch. An effect would also mean one
   * committed render answering the old question — which on a sign-out is a
   * frame of the previous account's UI.
   */
  const [latch, setLatch] = React.useState({ proven: false, ended: false });

  const next = authUser
    ? { proven: true, ended: false }
    : authDenied
      ? { proven: false, ended: true }
      : latch;
  if (next.proven !== latch.proven || next.ended !== latch.ended) {
    setLatch(next);
  }
  const { proven, ended } = next;

  /**
   * The same-tab "this browser is no longer signed in" signal, dispatched by
   * `apiFetch` the moment it clears auth state on a 401 and by the cross-tab
   * sign-out broadcast.
   *
   * It is not redundant with the 401 above. The native `storage` event does not
   * fire in the tab that made the change, so the ONE tab where the session
   * actually died is the one tab that would otherwise never learn of it — and
   * with a 15-minute staleTime its `/auth/me` never refetches on its own. This
   * is the fast, local, no-round-trip path.
   */
  React.useEffect(() => {
    const onCleared = () => setLatch({ proven: false, ended: true });
    window.addEventListener(IDENTITY_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(IDENTITY_CLEARED_EVENT, onCleared);
  }, []);

  /**
   * The forgeable `mr-auth` hint cookie, in its ONE narrow role: a cold load
   * where we have proven nothing and `/auth/me` failed for a reason that is NOT
   * a refusal. It can never outvote a 401, and it can never speak alone. That
   * veto is what keeps a signed-out visitor with a stale or forged cookie from
   * being treated as signed in.
   *
   * Read during render, not held in state. Safe despite `document.cookie` being
   * client-only, because the guard in front of it can never be true on the
   * first render: `isError` requires the query to have already run and failed.
   * So the cookie cannot influence the render that has to match the server's
   * HTML, and there is no hydration mismatch to create.
   *
   * `isAuthenticated()` itself returns false when `document` is undefined.
   */
  const hintMayVouch = !ended && isError && !authDenied && isAuthenticated();

  /**
   * A session we KNOW has ended outranks every optimistic signal — the hint
   * cookie and a stale `proven` from earlier in this tab's life included.
   */
  const signedIn = !ended && (!!authUser || proven || hintMayVouch);

  const status: SessionStatus = signedIn
    ? 'signed-in'
    : // 'unknown' is only honest while we have NOT yet learned the answer. Once
      // the session is known to have ended, waiting on a refetch that may never
      // settle just leaves a spinner on screen forever.
      ended
      ? 'signed-out'
      : isLoading
        ? 'unknown'
        : 'signed-out';

  return {
    status,
    isSignedIn: status === 'signed-in',
    isSignedOut: status === 'signed-out',
    user: authUser ?? undefined,
  };
}

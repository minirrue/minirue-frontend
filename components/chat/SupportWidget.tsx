'use client';

import React from 'react';
import ChatButton from '@/components/chat/ChatButton';
import ChatPanel, { type ChatDisplayMessage, type ChatAttachment } from '@/components/chat/ChatPanel';
import SignInToChat from '@/components/chat/SignInToChat';
import SubjectPicker, { type SubjectChoice } from '@/components/chat/SubjectPicker';
import { useSupportContext } from '@/lib/support/support-context';
// setGuestSupport is gone with guest chat. getGuestSupport/clearGuestSupport
// stay: tokens issued before backend 0.53.x are still honoured for READING and
// replying to a thread already started, so nobody is cut off mid-conversation.
import { getGuestSupport, clearGuestSupport } from '@/lib/support/session';
import { useUser } from '@/lib/hooks/use-auth';
import { useSessionState } from '@/lib/hooks/use-session-state';
import { useCustomerProfile } from '@/lib/hooks/use-customer';
import { IDENTITY_CLEARED_EVENT } from '@/lib/api/client';
import {
  apiStartSupport,
  apiSupportMessages,
  apiSendSupport,
  apiSupportMeta,
  apiSupportUpload,
  apiSupportClaim,
  apiSupportMine,
  apiSupportHeartbeat,
  type SupportConversationDto,
  type SupportMessageDto,
  type SupportMetaDto,
} from '@/lib/api/support';
import ConversationList from '@/components/chat/ConversationList';
import NewChatComposer, { type NewChatDraft } from '@/components/chat/NewChatComposer';
import { apiGetPublicSettings } from '@/lib/api/settings';

const POLL_INTERVAL_MS = 4000;
const META_POLL_INTERVAL_MS = 8000;
const HEARTBEAT_INTERVAL_MS = 20000;

const STATUS_COLORS: Record<SupportMetaDto['status'], string> = {
  ONLINE: '#4CAF50',
  IDLE: '#9E9E9E',
  AWAY: '#E0A400',
  OFFLINE: '#C0392B',
};

/** Shown until the real status is known. Neutral on purpose — defaulting to
 *  ONLINE made the dot flash green and then flip to red on every open, and any
 *  failed poll flipped it back again. */
const STATUS_UNKNOWN_COLOR = '#9E9E9E';

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** The start-conversation payload for a subject choice, shared by both entry points. */
function subjectInputFor(choice: SubjectChoice) {
  if (choice.type === 'ITEM') {
    return {
      type: 'ITEM' as const,
      productId: choice.subject.productId,
      orderId: choice.subject.orderId,
      subjectSnapshot: choice.subject.subjectSnapshot,
    };
  }
  return { type: 'GENERAL' as const };
}

function mapMessage(dto: SupportMessageDto): ChatDisplayMessage {
  // From the customer's view, anything not sent by the customer is the support side.
  // Backend sender types are CUSTOMER | STAFF | ADMIN | COLLAB | SYSTEM (never 'AGENT').
  const isAgent = dto.senderType !== 'CUSTOMER';
  return {
    id: dto.id,
    from: isAgent ? 'agent' : 'cx',
    name: dto.senderName ?? (isAgent ? 'MiniRue Support' : 'You'),
    senderAvatarUrl: dto.senderAvatarUrl ?? null,
    text: dto.body,
    time: formatTime(dto.createdAt),
    attachments: dto.attachments,
  };
}

export default function SupportWidget() {
  const { subject: pageSubject } = useSupportContext();
  // Reactive auth: `useUser().data` is the source of truth for "is this a logged-in
  // customer" — it updates when login completes (unlike the localStorage snapshot,
  // which is stale at widget-mount and never reacts to a login that happens later).
  const { data: authUser, isLoading: authLoading } = useUser();
  const isLoggedIn = !!authUser;
  /**
   * "Is this browser signed in", answered ONCE for the whole storefront.
   *
   * This used to be three `useState` flags declared right here — `sessionProven`,
   * `sessionEnded`, `hasStoredSession` — each encoding a rule paid for by a
   * production report. They were correct, and that was the problem: every OTHER
   * consumer (Header, MobileBottomNav, checkout) reimplemented the same question
   * more simply and got it wrong in a different direction, and the incidents on
   * 2026-07-31 were those implementations disagreeing. The rules are unchanged;
   * they now live in `lib/hooks/use-session-state.ts` where everyone reads them.
   *
   * Full trace: `docs/superpowers/runbooks/auth-state-map.md`.
   */
  const { status: sessionStatus } = useSessionState();
  // The shopper's OWN uploaded photo, used only for the optimistic bubble
  // between "Send" and the server's echo. The server resolves
  // `senderAvatarUrl` on the real message, but for that ~1s the bubble the
  // shopper is staring at is the one this file builds — and it used to carry
  // no avatar at all, so their own photo blinked to the generic icon on every
  // single send ("still my avatar shows generic avatar although i have
  // uploaded my avatar on customer account"). Query is shared with the rest
  // of the account area, so this is a cache read, not an extra request.
  const { data: customerProfile } = useCustomerProfile({ enabled: isLoggedIn });
  const myAvatarUrl = customerProfile?.avatarUrl ?? null;
  // Three views in one panel. 'thread' is the old behaviour; 'list' and 'new' are
  // what a shopper with more than one conversation actually needs.
  const [view, setView] = React.useState<'list' | 'thread' | 'new'>('thread');
  const [conversations, setConversations] = React.useState<SupportConversationDto[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  // A guest picks their brand before they have given contact details, so the
  // choice has to survive until the guest form is submitted.

  const [open, setOpen] = React.useState(false);
  const [hasUnread, setHasUnread] = React.useState(false);
  const [subjectChoice, setSubjectChoice] = React.useState<SubjectChoice>({ type: 'GENERAL' });
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatDisplayMessage[]>([]);
  const [sending, setSending] = React.useState(false);
  /**
   * Retired with guest chat (owner decision, 2026-07-29). Kept as a constant
   * rather than threaded out of every call site, because the guest→customer
   * CLAIM flow still runs for the threads migration 0038 archived — if one of
   * those people signs up, their thread still attaches to the new account.
   */
  const awaitingGuestInfo = false;
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<SupportMetaDto | null>(null);
  // The shop's own uploaded logo — the panel header's avatar (never the "MR"
  // monogram it replaced, never an initial letter). Fetched once; the same
  // public settings the storefront chrome already reads elsewhere.
  const [shopAvatarUrl, setShopAvatarUrl] = React.useState<string | null>(null);
  // The ONE shop name (2026-07-31 owner ask) — the panel header and the
  // "MiniRue Support" fallback sender name below both read this rather than
  // a hardcoded literal. Same fetch as the logo above; `null` until it
  // resolves falls back to ChatPanel's own "MiniRue Support" default.
  const [shopName, setShopName] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    apiGetPublicSettings()
      .then((s) => {
        if (!cancelled) {
          setShopAvatarUrl(s.logoUrl ?? null);
          setShopName(s.displayName || null);
        }
      })
      .catch(() => {
        // No logo fetched this session — the header falls back to the
        // generic person icon, never a broken image or a letter.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const lastMessageIdRef = React.useRef<string | undefined>(undefined);
  const tempCounterRef = React.useRef(0);
  /**
   * Monotonic staleness guard. Bumped exactly once per real identity
   * TRANSITION (below), never on the initial mount. Every async chain that
   * repaints state (resumeConversation's fetch, the bootstrap's claim+mine
   * chain, the message-poll tick) captures this value at the moment it
   * fires the request and refuses to touch state in its `.then` if the
   * token has since moved on — otherwise a promise that resolves AFTER a
   * logout/account-switch repaints the previous person's data over the
   * state the identity-reset effect just cleared. That is a narrower-window
   * recurrence of the exact cross-account leak the reset effect exists to
   * kill: it stops leaked state that was already sitting in React state,
   * but not a leaked repaint from a request that was already in flight.
   */
  const identityTokenRef = React.useRef(0);
  /**
   * `canMessage` (computed near the bottom, after the views it feeds) mirrored
   * into a ref so the send handlers declared above can refuse outright. The
   * composer is already replaced rather than hidden, so this should be
   * unreachable — which is the point: "not rendered" is a layout fact and this
   * is the behavioural one, and the guest branch has been reopened by a layout
   * regression more than once.
   */
  const canMessageRef = React.useRef(false);
  // Retry payloads for failed optimistic sends, keyed by tempId.
  const retryPayloadsRef = React.useRef<
    Map<string, { text: string; attachments?: ChatAttachment[] }>
  >(new Map());

  // Auto-attach the current page's subject (e.g. a product) when the widget
  // hasn't started a conversation yet.
  React.useEffect(() => {
    if (!conversationId && pageSubject) {
      setSubjectChoice({ type: 'ITEM', subject: pageSubject });
    }
  }, [pageSubject, conversationId]);

  const guestBootstrappedRef = React.useRef(false);
  const accountBootstrappedRef = React.useRef(false);

  const resumeConversation = React.useCallback((id: string) => {
    // Captured NOW, not read fresh inside the `.then` — the whole point is to
    // notice if identity moved on WHILE this request was in flight.
    const requestToken = identityTokenRef.current;
    setConversationId(id);
    setView('thread');
    // A resumed thread starts empty, so clear what the previous one left behind
    // rather than showing the wrong conversation's messages for a moment.
    seenIdsRef.current = new Set();
    lastMessageIdRef.current = undefined;
    setMessages([]);
    apiSupportMessages(id)
      .then((dtos) => {
        // The person who asked for this thread is gone (logout / switched
        // accounts) — the reset effect already cleared their state; do not
        // repaint it with a response addressed to them.
        if (identityTokenRef.current !== requestToken) return;
        const mapped = dtos.map(mapMessage);
        mapped.forEach((m) => seenIdsRef.current.add(m.id));
        if (dtos.length > 0) lastMessageIdRef.current = dtos[dtos.length - 1].id;
        setMessages(mapped);
      })
      .catch(() => {
        // Resume best-effort; if it fails the visitor can just start a new thread.
      });
  }, []);

  // This widget is mounted once globally (app/layout.tsx) and a logout never
  // unmounts it, so its identity-bound state — the conversation, its messages,
  // the list, every once-only bootstrap ref — has to be reset by hand on any
  // identity TRANSITION (including account A -> account B, not just logout).
  // Without this, a signed-out visitor's message can land on the previous
  // account's thread: a real cross-account leak, reproduced by the owner.
  const prevIdentityRef = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    if (authLoading) return;
    const identity = authUser?.userId ?? null;
    if (prevIdentityRef.current === undefined) { prevIdentityRef.current = identity; return; }
    if (prevIdentityRef.current === identity) return;
    prevIdentityRef.current = identity;
    // Invalidates every in-flight request issued under the old identity —
    // see identityTokenRef's own comment. Bumped BEFORE the resets below so
    // nothing issued this tick can race ahead of it.
    identityTokenRef.current += 1;

    // Identity changed. Nothing from the previous person may survive.
    setConversationId(null);
    setMessages([]);
    setConversations([]);
    setView('thread');
    setError(null);
    // The unread dot lives on the floating button, outside the panel, so it
    // survived every other reset here — a signed-out visitor kept seeing a
    // badge for a reply addressed to the previous account.
    setHasUnread(false);
    seenIdsRef.current = new Set();
    lastMessageIdRef.current = undefined;
    retryPayloadsRef.current = new Map();
    accountBootstrappedRef.current = false;
    guestBootstrappedRef.current = false;
    clearGuestSupport();
  }, [authUser, authLoading]);

  /**
   * Wipe the panel the instant the session ends — sign-out OR expiry, both.
   *
   * The identity effect above only fires on a TRANSITION of `authUser?.userId`.
   * That is not enough on its own: `useUser` is `retry: false` with a
   * 15-minute staleTime, so when a session dies without this tab making the
   * change — a sign-out in another tab, a server-side revocation, an expiry
   * discovered by some other request — `authUser` can stay populated and the
   * transition never happens. The panel then keeps the previous account's
   * conversation list on screen, which is exactly what the owner screenshotted
   * on a signed-out home page: "signed out and chat window still stale, it
   * must be autocleared on sign out or session expire both."
   *
   * `IDENTITY_CLEARED_EVENT` is dispatched by `apiFetch` the moment it clears
   * auth state on a 401, and by the cross-tab sign-out broadcast, so it covers
   * both cases and does not wait for a refetch. Bumping `identityTokenRef`
   * matters as much as the setters: any in-flight `apiSupportMine()` or
   * `apiSupportMessages()` issued under the old identity would otherwise
   * resolve straight back into the state we just cleared.
   */
  React.useEffect(() => {
    function onIdentityCleared() {
      identityTokenRef.current += 1;
      setConversationId(null);
      setMessages([]);
      setConversations([]);
      setView('thread');
      setError(null);
      setHasUnread(false);
      seenIdsRef.current = new Set();
      lastMessageIdRef.current = undefined;
      retryPayloadsRef.current = new Map();
      accountBootstrappedRef.current = false;
      guestBootstrappedRef.current = false;
      // `prevIdentityRef` is reset too, so the identity effect treats the next
      // sign-in as a fresh start rather than comparing against a person who is
      // no longer here.
      prevIdentityRef.current = null;
    }
    window.addEventListener(IDENTITY_CLEARED_EVENT, onIdentityCleared);
    return () => window.removeEventListener(IDENTITY_CLEARED_EVENT, onIdentityCleared);
  }, []);

  // Bootstrap once: claim any guest thread into the logged-in account, then
  // resume the account's most recent conversation across devices/sessions.
  // Guests (not logged in) just resume via their stored guest token.
  React.useEffect(() => {
    // Wait until auth resolves so a logged-in customer never takes the guest path.
    if (authLoading) return;

    if (isLoggedIn) {
      // Runs once when login becomes known: claim any per-browser guest thread into
      // the account (so it becomes the SAME chat, no duplicate), then resume the
      // account's most recent thread (persists across devices/sessions).
      if (accountBootstrappedRef.current) return;
      accountBootstrappedRef.current = true;
      // Same staleness guard as resumeConversation: this chain crosses two
      // network round-trips, so identity can move on (another logout, or a
      // fast switch to a THIRD account) before either resolves.
      const requestToken = identityTokenRef.current;
      const isStale = () => identityTokenRef.current !== requestToken;
      const guest = getGuestSupport();
      const claimIfNeeded = guest?.guestToken ? apiSupportClaim() : Promise.resolve(null);
      claimIfNeeded
        .catch(() => null)
        .then((claimed) => {
          // Bail before even issuing the follow-up request — nothing this
          // chain does from here on belongs to whoever is signed in now.
          if (isStale()) return null;
          // Only drop the guest token once the claim actually succeeded — if it
          // failed (endpoint error / not yet deployed) keep the token so the
          // guest thread can still be claimed later instead of being orphaned.
          if (claimed) clearGuestSupport();
          return apiSupportMine().then((mine) => ({ claimed, mine }));
        })
        .then((result) => {
          if (!result || isStale()) return;
          const { claimed, mine } = result;
          if (mine) setConversations(mine);
          if (claimed) {
            // The claim already tells us the single surviving thread — resume
            // it directly rather than guessing from `mine`.
            resumeConversation(claimed.id);
            return;
          }
          // With more than one conversation, dropping straight into the most
          // recent hides the others and there was no way to reach them. Land on
          // the list instead; a single thread still opens directly, since a list
          // of one is just an extra tap.
          if ((mine?.length ?? 0) > 1) {
            setView('list');
            return;
          }
          const latest = mine?.[0];
          if (latest) resumeConversation(latest.id);
          else setView('new');
        })
        .catch(() => {
          // Bootstrap best-effort; a fresh conversation will start on send.
        });
      return;
    }

    // NOT signed in. Nothing is resumed, deliberately.
    //
    // This branch used to read `mr-support-guest` from localStorage and resume
    // that conversation. It is how a signed-out visitor still saw their old
    // chats — the owner's repeated report — and it survived all eight of the
    // sign-out fixes because it never touches the auth session at all: no
    // cookie, no token, no /auth/me. A cold page load on /login was enough.
    //
    // It also cannot be caught by the identity-reset effect below, which only
    // fires on a TRANSITION. On a fresh load there is no transition — the
    // effect records the starting identity and returns — so clearGuestSupport()
    // never runs and the stored thread is resumed for whoever opens the panel.
    //
    // Guest messaging was retired (owner decision, 2026-07-29) and the server
    // refuses a guest start, so there is nothing here worth resuming: a
    // signed-out visitor gets the sign-in prompt, which is what SignInToChat
    // is for.
    //
    // The stored token is deliberately NOT cleared. It is still the input to
    // the CLAIM flow above — if this person signs up or signs in, their old
    // thread attaches to the account rather than being orphaned. Clearing it
    // here would trade one bug for a quieter one.
    if (guestBootstrappedRef.current) return;
    guestBootstrappedRef.current = true;
    // `authUser?.userId` (not just `isLoggedIn`) is deliberate: Account A ->
    // Account B never flips the boolean, so keying only on it left B's
    // thread never auto-resumed — `accountBootstrappedRef` was reset by the
    // identity effect, but nothing re-ran this effect to see that reset.
  }, [isLoggedIn, authLoading, resumeConversation, authUser?.userId]);

  const appendMessages = React.useCallback((dtos: SupportMessageDto[], markUnreadIfClosed: boolean) => {
    const fresh = dtos.filter((d) => !seenIdsRef.current.has(d.id));
    if (fresh.length === 0) return;
    fresh.forEach((d) => seenIdsRef.current.add(d.id));
    lastMessageIdRef.current = fresh[fresh.length - 1].id;
    setMessages((prev) => [...prev, ...fresh.map(mapMessage)]);
    if (markUnreadIfClosed && fresh.some((d) => d.senderType !== 'CUSTOMER')) {
      setHasUnread(true);
    }
  }, []);

  const loadConversations = React.useCallback(async () => {
    setListLoading(true);
    try {
      const mine = await apiSupportMine();
      setConversations(mine);
      return mine;
    } finally {
      setListLoading(false);
    }
  }, []);

  // Opening the panel refreshes the list, so a thread the team replied to while
  // the widget was shut shows as unread straight away.
  React.useEffect(() => {
    if (!open || !isLoggedIn) return;
    void loadConversations();
  }, [open, isLoggedIn, loadConversations]);

  // Fetch reply-time + presence when the panel opens, then poll while it's open.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = () => {
      apiSupportMeta()
        .then((m) => {
          // Keep the last known status when a poll returns nothing — an empty
          // response is "we could not check", not "the store went offline".
          if (!cancelled && m) setMeta(m);
        })
        .catch(() => {
          // Same reasoning: a failed poll must not change the badge.
        });
    };
    load();
    const interval = window.setInterval(load, META_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open]);

  // Poll for new messages once a conversation exists.
  React.useEffect(() => {
    if (!conversationId) return;
    const interval = window.setInterval(() => {
      // Captured per-TICK, not once for the whole effect: identity can
      // change between one tick and the next without this effect re-running
      // (conversationId is cleared by the same reset, but that clear and
      // this in-flight request are a race — clearInterval on cleanup only
      // stops FUTURE ticks, not a request already sent).
      const requestToken = identityTokenRef.current;
      apiSupportMessages(conversationId, lastMessageIdRef.current)
        .then((dtos) => {
          if (identityTokenRef.current !== requestToken) return;
          appendMessages(dtos, !open);
        })
        .catch(() => {
          // Transient network errors are fine to skip; next tick retries.
        });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [conversationId, open, appendMessages]);

  // Presence heartbeat: once a conversation exists, tell the backend whether
  // this customer's tab is focused ('active') or backgrounded ('idle') so the
  // dashboard can show ONLINE / IDLE / OFFLINE. No socket (Vercel hobby kills
  // WebSockets) — poll instead. Crucially we DO NOT pause when hidden: a
  // backgrounded tab must still report 'idle' (which reads IDLE, not OFFLINE);
  // OFFLINE is reserved for a genuinely closed tab, where pings stop and the
  // backend TTL lapses. Independent of the message/meta polling above.
  React.useEffect(() => {
    if (!conversationId) return;
    const beat = () => {
      const state = document.visibilityState === 'hidden' ? 'idle' : 'active';
      void apiSupportHeartbeat(conversationId, state);
    };
    beat(); // immediate ping so presence shows without a 20s wait
    const interval = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    // Fire immediately on tab switch so ONLINE⇄IDLE updates fast, not on the
    // next 20s tick.
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [conversationId]);

  // Optimistic-send helpers: show the customer's message immediately, then
  // reconcile with the server response (or mark it failed with a retry).
  const addOptimisticMessage = React.useCallback(
    (text: string, attachments?: ChatAttachment[]) => {
      const tempId = `temp-${++tempCounterRef.current}`;
      retryPayloadsRef.current.set(tempId, { text, attachments });
      const optimistic: ChatDisplayMessage = {
        id: tempId,
        from: 'cx',
        name: 'You',
        senderAvatarUrl: myAvatarUrl,
        text,
        time: formatTime(new Date().toISOString()),
        attachments,
        status: 'sending',
        tempId,
      };
      setMessages((prev) => [...prev, optimistic]);
      return tempId;
    },
    [myAvatarUrl],
  );

  const markSent = React.useCallback((tempId: string, real: SupportMessageDto) => {
    // Register the real id BEFORE the next poll tick so appendMessages skips it.
    seenIdsRef.current.add(real.id);
    lastMessageIdRef.current = real.id;
    retryPayloadsRef.current.delete(tempId);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.tempId !== tempId) return m;
        const mapped = mapMessage(real);
        // The server's own attachment DTOs never carry `localFile` — it is a
        // client-only field for bytes this session just uploaded. Carry it
        // over from the optimistic bubble (matched by URL, which the server
        // echoes back unchanged) so the message keeps showing those bytes
        // instead of momentarily reverting to a cold, unproven remote URL
        // right at the exact moment this reconciliation swaps the bubble.
        const attachments = mapped.attachments?.map((a) => {
          const optimistic = m.attachments?.find((oa) => oa.url === a.url);
          return optimistic?.localFile ? { ...a, localFile: optimistic.localFile } : a;
        });
        return { ...mapped, attachments, status: 'sent' };
      }),
    );
  }, []);

  const markFailed = React.useCallback((tempId: string) => {
    setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m)));
  }, []);

  const currentSubjectInput = React.useCallback(
    () => subjectInputFor(subjectChoice),
    [subjectChoice],
  );

  const startConversation = React.useCallback(
    async (
      body: string,
      attachments?: ChatAttachment[],
      existingTempId?: string,
      override?: {
        collaboratorId?: string | null;
        subject?: SubjectChoice;
        /**
         * An explicit "New conversation" press. Only handleNewChat sets this —
         * the bootstrap auto-resume path and the plain composer send never do,
         * since opening the widget and typing is the IMPLICIT path the server
         * still dedups, not an instruction to open another room.
         */
        forceNew?: boolean;
      },
    ) => {
      // Nobody unverified starts a thread, whatever managed to call this.
      if (!canMessageRef.current) return;
      if (override?.forceNew) {
        // A brand-new room starts empty. Without this the optimistic bubble
        // below is appended to whatever thread was previously loaded and the
        // shopper sees the old conversation instead of a new one. Gated on
        // forceNew because the implicit composer-send path deliberately
        // appends into what the server dedups.
        seenIdsRef.current = new Set();
        lastMessageIdRef.current = undefined;
        setMessages([]);
      }
      const tempId = existingTempId ?? addOptimisticMessage(body, attachments);
      setSending(true);
      setError(null);
      try {
        const subjectInput = override?.subject
          ? subjectInputFor(override.subject)
          : currentSubjectInput();
        const result = await apiStartSupport({
          ...subjectInput,
          // Only a GENERAL thread carries a chosen brand; an ITEM thread is routed
          // by its product and the API refuses to be redirected.
          ...(subjectInput.type === 'GENERAL' && override?.collaboratorId
            ? { collaboratorId: override.collaboratorId }
            : {}),
          body,
          attachments,
          ...(override?.forceNew ? { forceNew: true } : {}),
          // No `guest` field: starting a conversation needs an account, and
          // the server refuses a guest start outright (backend 0.53.x).
        });
        setConversationId(result.conversation.id);
        setView('thread');
        markSent(tempId, result.message);
      } catch (err: unknown) {
        markFailed(tempId);
        // The API says WHY — "this conversation is closed", "attachments are not
        // enabled yet" — and that is what the shopper needs to read.
        setError(
          (err instanceof Error && err.message) ||
            'Could not send your message. Please try again.',
        );
      } finally {
        setSending(false);
      }
    },
    [currentSubjectInput, addOptimisticMessage, markSent, markFailed],
  );

  const handleSend = React.useCallback(
    (text: string, attachments?: ChatAttachment[]) => {
      // Same gate as the composer that produced this call — see canMessageRef.
      if (!canMessageRef.current) return;
      if (conversationId) {
        const tempId = addOptimisticMessage(text, attachments);
        setSending(true);
        setError(null);
        apiSendSupport(conversationId, text, attachments)
          .then((dto) => markSent(tempId, dto))
          .catch(() => {
            markFailed(tempId);
            setError('Could not send your message. Please try again.');
          })
          .finally(() => setSending(false));
        return;
      }

      // Only a signed-in customer reaches the composer at all — a guest gets
      // SignInToChat instead — so there is nothing to hold back and no contact
      // form to collect. This used to park the message and ask for a name,
      // email and phone.
      void startConversation(text, attachments);
    },
    [conversationId, startConversation, addOptimisticMessage, markSent, markFailed, isLoggedIn],
  );

  const handleRetry = React.useCallback(
    (tempId: string) => {
      const payload = retryPayloadsRef.current.get(tempId);
      if (!payload) return;
      setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, status: 'sending' } : m)));
      if (conversationId) {
        setSending(true);
        setError(null);
        apiSendSupport(conversationId, payload.text, payload.attachments)
          .then((dto) => markSent(tempId, dto))
          .catch(() => {
            markFailed(tempId);
            setError('Could not send your message. Please try again.');
          })
          .finally(() => setSending(false));
        return;
      }
      // No conversation yet (the initial start failed) — retry via startConversation,
      // reusing the same optimistic bubble instead of creating a new one.
      void startConversation(payload.text, payload.attachments, tempId);
    },
    [conversationId, startConversation, markSent, markFailed],
  );

  const toggleOpen = () => {
    setOpen((o) => !o);
    setHasUnread(false);
  };

  const handleNewChat = React.useCallback(
    (draft: NewChatDraft) => {
      const subject: SubjectChoice = draft.subject
        ? { type: 'ITEM', subject: draft.subject }
        : { type: 'GENERAL' };

      // No guest branch: a guest never reaches this composer, so the draft
      // always belongs to a signed-in customer.
      //
      // forceNew: true unconditionally — pressing "New conversation" is an
      // explicit instruction the server now obeys with no conditions (owner
      // decision, W1.6): not if the old thread is open, not if it's resolved,
      // not if it's five minutes old. Every OTHER call to startConversation
      // (the bootstrap auto-resume, the plain composer send) omits it, so the
      // implicit "widget opened, message typed, button never pressed" path
      // still dedups into the shopper's live thread exactly as before.
      void startConversation(draft.body, undefined, undefined, {
        collaboratorId: draft.collaboratorId,
        subject,
        forceNew: true,
      }).then(() => {
        void loadConversations();
      });
    },
    [isLoggedIn, startConversation, loadConversations],
  );

  // Only a customer can hold several threads; a guest is bound to the one their
  // token names, so the list would always have exactly one row.
  const canBrowseList = isLoggedIn;

  /**
   * Who gets a composer. Three states, not two — and the third is the one the
   * owner kept screenshotting.
   *
   * Messaging needs an account (owner decision, 2026-07-29) and the server
   * refuses a guest start outright, so a composer offered to anyone we have not
   * verified can only ever produce a 401 after they have typed.
   *
   *  'allowed' — a real session, per `useSessionState()`: `/auth/me` answered
   *              with a user right now, or answered with one earlier in this
   *              tab and nothing has revoked it since. The second half is what
   *              keeps a genuine customer from being told to sign in when one
   *              background `/auth/me` fails.
   *
   *  'pending' — we have not heard back yet. Neither a composer NOR a sign-in
   *              prompt: telling a signed-in shopper to sign in reads as being
   *              logged out, and this state used to fall through to the full
   *              thread view, so the composer was live for as long as
   *              `/auth/me` took to fail — and forever if it never settled.
   *              That is the state the session-expired screenshot caught.
   *
   *  'blocked' — settled, and no session. SignInToChat, nothing else.
   *
   * The three-way shape is deliberate and matches `SessionStatus` one for one.
   * Collapsing 'pending' into either neighbour re-creates a shipped bug in one
   * direction or the other — see the runbook's §2 decision table.
   */
  const chatAccess: 'allowed' | 'pending' | 'blocked' =
    sessionStatus === 'signed-in'
      ? 'allowed'
      : sessionStatus === 'unknown'
        ? 'pending'
        : 'blocked';
  const guestBlocked = chatAccess === 'blocked';
  /** The single gate for every writable surface: composer, subject picker, send. */
  const canMessage = chatAccess === 'allowed';
  // Assigned during render, so it is already correct by the time any handler
  // declared above can possibly fire.
  canMessageRef.current = canMessage;

  const panelBody = guestBlocked ? (
    <SignInToChat />
  ) : !canMessage ? (
    <div
      style={{
        padding: '28px 24px',
        fontFamily: 'Inter Tight, sans-serif',
        fontSize: 13,
        color: 'var(--mr-ink-400)',
      }}
    >
      Checking your account…
    </div>
  ) : view === 'new' ? (
      <NewChatComposer
        pageSubject={pageSubject}
        submitting={sending}
        onSubmit={handleNewChat}
        onCancel={() => setView(canBrowseList ? 'list' : 'thread')}
      />
    ) : view === 'list' ? (
      <ConversationList
        conversations={conversations}
        loading={listLoading}
        onOpen={(id) => resumeConversation(id)}
        onNew={() => setView('new')}
        shopName={shopName ?? undefined}
      />
    ) : undefined;

  return (
    <>
      <ChatButton
        onClick={toggleOpen}
        hasUnread={hasUnread}
        open={open}
        shopAvatarUrl={shopAvatarUrl}
        shopName={shopName ?? undefined}
      />
      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        onSend={handleSend}
        sending={sending}
        inputDisabled={awaitingGuestInfo}
        headerSubtitle={meta?.replyTimeText ?? undefined}
        statusColor={meta ? STATUS_COLORS[meta.status] : STATUS_UNKNOWN_COLOR}
        onUpload={apiSupportUpload}
        referenceId={conversationId ?? undefined}
        onRetry={handleRetry}
        body={panelBody}
        shopAvatarUrl={shopAvatarUrl}
        headerTitle={shopName ?? undefined}
        onBack={
          // Only offer a way back when there is a list to go back TO.
          canBrowseList && view === 'thread'
            ? () => {
                setView('list');
                void loadConversations();
              }
            : undefined
        }
        // bottomSlot renders INSTEAD of the composer, so an empty one closes
        // it: a guest has nothing to send to, and an inviting text box that
        // 401s on submit is worse than no box. Belt and braces — `panelBody`
        // above already replaces the whole thread view (ChatPanel's `body`
        // wins over both slots) — but the two must never be able to disagree,
        // so both read `canMessage`, not two separate booleans.
        bottomSlot={!canMessage ? <span /> : undefined}
        topSlot={
          canMessage && !conversationId ? (
            <SubjectPicker pageSubject={pageSubject} value={subjectChoice} onChange={setSubjectChoice} />
          ) : undefined
        }
      />
      {error && (
        <div
          role="alert"
          style={{
            position: 'fixed', bottom: 88, right: 24, zIndex: 201,
            background: '#B3261E', color: '#fff', padding: '6px 12px', borderRadius: 8,
            fontFamily: 'Inter Tight, sans-serif', fontSize: 11,
            display: open ? 'block' : 'none',
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}

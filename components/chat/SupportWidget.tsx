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
import { isAuthenticated } from '@/lib/auth/tokens';
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
   * The browser's own hint that a session exists. Not a security check — it is
   * documented as one that must never be trusted for access — but it is a
   * perfectly good signal that we should not show a stranger's screen to
   * someone who has an account.
   */
  const [hasStoredSession, setHasStoredSession] = React.useState(false);
  React.useEffect(() => {
    setHasStoredSession(isAuthenticated());
  }, [authUser, authLoading]);

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

  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const lastMessageIdRef = React.useRef<string | undefined>(undefined);
  const tempCounterRef = React.useRef(0);
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
    setConversationId(id);
    setView('thread');
    // A resumed thread starts empty, so clear what the previous one left behind
    // rather than showing the wrong conversation's messages for a moment.
    seenIdsRef.current = new Set();
    lastMessageIdRef.current = undefined;
    setMessages([]);
    apiSupportMessages(id)
      .then((dtos) => {
        const mapped = dtos.map(mapMessage);
        mapped.forEach((m) => seenIdsRef.current.add(m.id));
        if (dtos.length > 0) lastMessageIdRef.current = dtos[dtos.length - 1].id;
        setMessages(mapped);
      })
      .catch(() => {
        // Resume best-effort; if it fails the visitor can just start a new thread.
      });
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
      const guest = getGuestSupport();
      const claimIfNeeded = guest?.guestToken ? apiSupportClaim() : Promise.resolve(null);
      claimIfNeeded
        .catch(() => null)
        .then((claimed) => {
          // Only drop the guest token once the claim actually succeeded — if it
          // failed (endpoint error / not yet deployed) keep the token so the
          // guest thread can still be claimed later instead of being orphaned.
          if (claimed) clearGuestSupport();
          return apiSupportMine().then((mine) => ({ claimed, mine }));
        })
        .then(({ claimed, mine }) => {
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

    // Guest: resume the per-browser thread from the stored token.
    if (guestBootstrappedRef.current) return;
    guestBootstrappedRef.current = true;
    const guest = getGuestSupport();
    if (guest) resumeConversation(guest.conversationId);
  }, [isLoggedIn, authLoading, resumeConversation]);

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
      apiSupportMessages(conversationId, lastMessageIdRef.current)
        .then((dtos) => appendMessages(dtos, !open))
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
        text,
        time: formatTime(new Date().toISOString()),
        attachments,
        status: 'sending',
        tempId,
      };
      setMessages((prev) => [...prev, optimistic]);
      return tempId;
    },
    [],
  );

  const markSent = React.useCallback((tempId: string, real: SupportMessageDto) => {
    // Register the real id BEFORE the next poll tick so appendMessages skips it.
    seenIdsRef.current.add(real.id);
    lastMessageIdRef.current = real.id;
    retryPayloadsRef.current.delete(tempId);
    setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...mapMessage(real), status: 'sent' } : m)));
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
   * A guest gets the sign-in panel and nothing else — no subject picker, no
   * composer, no thread. Messaging needs an account (owner decision,
   * 2026-07-29), and the server refuses a guest start regardless, so offering
   * the form would only produce a 401 after they had typed.
   *
   * `authLoading` is deliberately excluded: showing "sign in" for a moment to
   * someone who IS signed in reads as being logged out, so the panel stays
   * empty until we know.
   */
  /**
   * Only block someone we are CONFIDENT is a guest.
   *
   * useUser() is `retry: false` with a 15-minute staleTime, so one transient
   * /auth/me failure — a refresh landing mid-flight, a cold API — leaves
   * `authUser` undefined for the next quarter of an hour. That was telling
   * signed-in customers to sign in while the header, which reads the stored
   * session, greeted them by name two lines above.
   *
   * So the stored session flag gets a veto. If anything says this person has
   * an account, show them the chat: the server refuses a guest start anyway
   * (backend 0.53.1) with a message that names the reason. Being wrong that
   * way costs a clear error; being wrong the other way locks a paying customer
   * out of support and contradicts the header while doing it.
   *
   * The real fix is one source of truth for "am I signed in" — three still
   * disagree (the httpOnly cookie, the mr-auth flag, the localStorage note).
   * That is deliberately not attempted here.
   */
  const looksSignedIn = isLoggedIn || hasStoredSession;
  const guestBlocked = !looksSignedIn && !authLoading;

  const panelBody = guestBlocked ? (
    <SignInToChat />
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
      />
    ) : undefined;

  return (
    <>
      <ChatButton onClick={toggleOpen} hasUnread={hasUnread} open={open} />
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
        // 401s on submit is worse than no box.
        bottomSlot={guestBlocked ? <span /> : undefined}
        topSlot={
          !guestBlocked && !conversationId ? (
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

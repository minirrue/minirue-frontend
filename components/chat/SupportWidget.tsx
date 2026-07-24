'use client';

import React from 'react';
import ChatButton from '@/components/chat/ChatButton';
import ChatPanel, { type ChatDisplayMessage, type ChatAttachment } from '@/components/chat/ChatPanel';
import GuestContactForm, { type GuestContactValue } from '@/components/chat/GuestContactForm';
import SubjectPicker, { type SubjectChoice } from '@/components/chat/SubjectPicker';
import { useSupportContext } from '@/lib/support/support-context';
import { getGuestSupport, setGuestSupport, clearGuestSupport } from '@/lib/support/session';
import { useUser } from '@/lib/hooks/use-auth';
import {
  apiStartSupport,
  apiSupportMessages,
  apiSendSupport,
  apiSupportMeta,
  apiSupportUpload,
  apiSupportClaim,
  apiSupportMine,
  apiSupportHeartbeat,
  type SupportMessageDto,
  type SupportMetaDto,
} from '@/lib/api/support';

const POLL_INTERVAL_MS = 4000;
const META_POLL_INTERVAL_MS = 8000;
const HEARTBEAT_INTERVAL_MS = 20000;

const STATUS_COLORS: Record<SupportMetaDto['status'], string> = {
  ONLINE: '#4CAF50',
  IDLE: '#9E9E9E',
  AWAY: '#E0A400',
  OFFLINE: '#C0392B',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const [open, setOpen] = React.useState(false);
  const [hasUnread, setHasUnread] = React.useState(false);
  const [subjectChoice, setSubjectChoice] = React.useState<SubjectChoice>({ type: 'GENERAL' });
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatDisplayMessage[]>([]);
  const [sending, setSending] = React.useState(false);
  const [awaitingGuestInfo, setAwaitingGuestInfo] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<SupportMetaDto | null>(null);

  const pendingBodyRef = React.useRef<{ text: string; attachments?: ChatAttachment[] } | null>(null);
  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const lastMessageIdRef = React.useRef<string | undefined>(undefined);

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
          if (claimed) {
            // The claim already tells us the single surviving thread — resume
            // it directly rather than guessing from `mine`.
            resumeConversation(claimed.id);
            return;
          }
          const latest = mine?.[0];
          if (latest) resumeConversation(latest.id);
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

  // Fetch reply-time + presence when the panel opens, then poll while it's open.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = () => {
      apiSupportMeta().then((m) => {
        if (!cancelled) setMeta(m);
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

  const currentSubjectInput = React.useCallback(() => {
    if (subjectChoice.type === 'ITEM') {
      return {
        type: 'ITEM' as const,
        productId: subjectChoice.subject.productId,
        orderId: subjectChoice.subject.orderId,
        subjectSnapshot: subjectChoice.subject.subjectSnapshot,
      };
    }
    return { type: 'GENERAL' as const };
  }, [subjectChoice]);

  const startConversation = React.useCallback(
    async (body: string, guest?: GuestContactValue, attachments?: ChatAttachment[]) => {
      setSending(true);
      setError(null);
      try {
        const result = await apiStartSupport({
          ...currentSubjectInput(),
          body,
          attachments,
          guest: guest
            ? { name: guest.name, email: guest.email, phoneCountry: guest.phoneCountry, phone: guest.phone }
            : undefined,
        });
        seenIdsRef.current.add(result.message.id);
        lastMessageIdRef.current = result.message.id;
        setMessages([mapMessage(result.message)]);
        setConversationId(result.conversation.id);
        if (guest && result.guestToken) {
          setGuestSupport({ conversationId: result.conversation.id, guestToken: result.guestToken });
        }
      } catch {
        setError('Could not send your message. Please try again.');
      } finally {
        setSending(false);
      }
    },
    [currentSubjectInput],
  );

  const handleSend = React.useCallback(
    (text: string, attachments?: ChatAttachment[]) => {
      if (conversationId) {
        setSending(true);
        setError(null);
        apiSendSupport(conversationId, text, attachments)
          .then((dto) => appendMessages([dto], false))
          .catch(() => setError('Could not send your message. Please try again.'))
          .finally(() => setSending(false));
        return;
      }

      if (isLoggedIn) {
        void startConversation(text, undefined, attachments);
        return;
      }

      // Guest: hold the message until contact details are provided.
      pendingBodyRef.current = { text, attachments };
      setAwaitingGuestInfo(true);
    },
    [conversationId, startConversation, appendMessages, isLoggedIn],
  );

  const handleGuestSubmit = React.useCallback(
    (contact: GuestContactValue) => {
      const pending = pendingBodyRef.current;
      if (!pending) return;
      void startConversation(pending.text, contact, pending.attachments).then(() => {
        pendingBodyRef.current = null;
        setAwaitingGuestInfo(false);
      });
    },
    [startConversation],
  );

  const toggleOpen = () => {
    setOpen((o) => !o);
    setHasUnread(false);
  };

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
        statusColor={STATUS_COLORS[meta?.status ?? 'ONLINE']}
        onUpload={apiSupportUpload}
        referenceId={conversationId ?? undefined}
        topSlot={
          !conversationId ? (
            <SubjectPicker pageSubject={pageSubject} value={subjectChoice} onChange={setSubjectChoice} />
          ) : undefined
        }
        bottomSlot={awaitingGuestInfo ? <GuestContactForm onSubmit={handleGuestSubmit} submitting={sending} /> : undefined}
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

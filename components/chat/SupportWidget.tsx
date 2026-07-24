'use client';

import React from 'react';
import ChatButton from '@/components/chat/ChatButton';
import ChatPanel, { type ChatDisplayMessage } from '@/components/chat/ChatPanel';
import GuestContactForm, { type GuestContactValue } from '@/components/chat/GuestContactForm';
import SubjectPicker, { type SubjectChoice } from '@/components/chat/SubjectPicker';
import { useSupportContext } from '@/lib/support/support-context';
import { getGuestSupport, setGuestSupport } from '@/lib/support/session';
import { getSession } from '@/lib/session';
import {
  apiStartSupport,
  apiSupportMessages,
  apiSendSupport,
  type SupportMessageDto,
} from '@/lib/api/support';

const POLL_INTERVAL_MS = 4000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mapMessage(dto: SupportMessageDto): ChatDisplayMessage {
  const isAgent = dto.senderType === 'AGENT' || dto.senderType === 'SYSTEM';
  return {
    id: dto.id,
    from: isAgent ? 'agent' : 'cx',
    name: dto.senderName ?? (isAgent ? 'MiniRue Support' : 'You'),
    text: dto.body,
    time: formatTime(dto.createdAt),
  };
}

export default function SupportWidget() {
  const { subject: pageSubject } = useSupportContext();

  const [open, setOpen] = React.useState(false);
  const [hasUnread, setHasUnread] = React.useState(false);
  const [subjectChoice, setSubjectChoice] = React.useState<SubjectChoice>({ type: 'GENERAL' });
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatDisplayMessage[]>([]);
  const [sending, setSending] = React.useState(false);
  const [awaitingGuestInfo, setAwaitingGuestInfo] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pendingBodyRef = React.useRef<string | null>(null);
  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const lastMessageIdRef = React.useRef<string | undefined>(undefined);

  // Auto-attach the current page's subject (e.g. a product) when the widget
  // hasn't started a conversation yet.
  React.useEffect(() => {
    if (!conversationId && pageSubject) {
      setSubjectChoice({ type: 'ITEM', subject: pageSubject });
    }
  }, [pageSubject, conversationId]);

  // Resume an existing guest conversation from localStorage, if any.
  React.useEffect(() => {
    const guest = getGuestSupport();
    if (!guest) return;
    setConversationId(guest.conversationId);
    apiSupportMessages(guest.conversationId)
      .then((dtos) => {
        const mapped = dtos.map(mapMessage);
        mapped.forEach((m) => seenIdsRef.current.add(m.id));
        if (dtos.length > 0) lastMessageIdRef.current = dtos[dtos.length - 1].id;
        setMessages(mapped);
      })
      .catch(() => {
        // Resume best-effort; if it fails the guest can just start a new thread.
      });
  }, []);

  const appendMessages = React.useCallback((dtos: SupportMessageDto[], markUnreadIfClosed: boolean) => {
    const fresh = dtos.filter((d) => !seenIdsRef.current.has(d.id));
    if (fresh.length === 0) return;
    fresh.forEach((d) => seenIdsRef.current.add(d.id));
    lastMessageIdRef.current = fresh[fresh.length - 1].id;
    setMessages((prev) => [...prev, ...fresh.map(mapMessage)]);
    if (markUnreadIfClosed && fresh.some((d) => d.senderType === 'AGENT')) {
      setHasUnread(true);
    }
  }, []);

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
    async (body: string, guest?: GuestContactValue) => {
      setSending(true);
      setError(null);
      try {
        const result = await apiStartSupport({
          ...currentSubjectInput(),
          body,
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
    (text: string) => {
      if (conversationId) {
        setSending(true);
        setError(null);
        apiSendSupport(conversationId, text)
          .then((dto) => appendMessages([dto], false))
          .catch(() => setError('Could not send your message. Please try again.'))
          .finally(() => setSending(false));
        return;
      }

      const session = getSession();
      if (session) {
        void startConversation(text);
        return;
      }

      // Guest: hold the message until contact details are provided.
      pendingBodyRef.current = text;
      setAwaitingGuestInfo(true);
    },
    [conversationId, startConversation, appendMessages],
  );

  const handleGuestSubmit = React.useCallback(
    (contact: GuestContactValue) => {
      const body = pendingBodyRef.current;
      if (!body) return;
      void startConversation(body, contact).then(() => {
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
      <ChatButton onClick={toggleOpen} hasUnread={hasUnread} />
      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        onSend={handleSend}
        sending={sending}
        inputDisabled={awaitingGuestInfo}
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

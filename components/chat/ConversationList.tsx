'use client';

import React from 'react';
import type { SupportConversationDto } from '@/lib/api/support';

/**
 * The shopper's own conversations.
 *
 * The widget only ever handled ONE thread: it resumed the most recent and there
 * was no way back to the others, so a question about a specific brand and a
 * general one were the same box. Now that a thread can be addressed to a brand,
 * a list is the only honest way to show them.
 */
interface Props {
  conversations: SupportConversationDto[];
  onOpen: (id: string) => void;
  onNew: () => void;
  loading?: boolean;
}

function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Unread to the CUSTOMER: someone else wrote after they last read it. */
function isUnread(c: SupportConversationDto): boolean {
  if (!c.lastMessageAt) return false;
  if (c.lastMessageSenderType === 'CUSTOMER') return false;
  if (!c.customerReadAt) return true;
  return c.customerReadAt < c.lastMessageAt;
}

function isClosed(c: SupportConversationDto): boolean {
  return c.status === 'RESOLVED' || c.status === 'CLOSED';
}

export default function ConversationList({
  conversations,
  onOpen,
  onNew,
  loading,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading && conversations.length === 0 ? (
          <p style={emptyStyle}>Loading your conversations…</p>
        ) : conversations.length === 0 ? (
          <p style={emptyStyle}>
            No conversations yet. Start one and we&apos;ll reply as soon as we can.
          </p>
        ) : (
          conversations.map((c) => {
            const unread = isUnread(c);
            const closed = isClosed(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpen(c.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: '1px solid var(--mr-hairline)',
                  // A gold spine for unread, so a glance is enough.
                  boxShadow: unread ? 'inset 3px 0 0 0 var(--mr-gold-500)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  opacity: closed ? 0.6 : 1,
                  fontFamily: 'Inter Tight, sans-serif',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: unread ? 600 : 500,
                      color: 'var(--mr-ink-900)',
                    }}
                  >
                    {/* Who they are talking to is the identity of the thread — the
                        customer already knows who they themselves are. */}
                    {c.brandName || 'MiniRue'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--mr-ink-400)' }}>
                    {timeLabel(c.lastMessageAt)}
                  </span>
                </span>

                <span
                  style={{
                    display: 'block',
                    marginTop: 3,
                    fontSize: 11.5,
                    color: unread ? 'var(--mr-ink-700)' : 'var(--mr-ink-400)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.lastMessagePreview || 'No messages yet'}
                </span>

                {closed && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 5,
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-ink-400)',
                      border: '1px solid var(--mr-hairline)',
                      borderRadius: 4,
                      padding: '1px 5px',
                    }}
                  >
                    Closed
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--mr-hairline)' }}>
        <button
          type="button"
          onClick={onNew}
          style={{
            width: '100%',
            padding: '10px 14px',
            border: 'none',
            borderRadius: 8,
            background: 'var(--mr-ink-900)',
            color: 'var(--mr-cream-100)',
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          New conversation
        </button>
      </div>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: '18px 14px',
  fontFamily: 'Inter Tight, sans-serif',
  fontSize: 12,
  color: 'var(--mr-ink-400)',
  lineHeight: 1.5,
};

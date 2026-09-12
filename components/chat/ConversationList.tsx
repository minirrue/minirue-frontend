'use client';

import React from 'react';
import type { SupportConversationDto } from '@/lib/api/support';
import Button from '@/components/ui/Button';

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
  /**
   * The ONE admin-editable shop name (2026-07-31 owner ask) — shown for a
   * house-desk (no `brandName`) thread instead of a hardcoded "MiniRue"
   * literal. `undefined` falls back to the same literal, so a caller with no
   * shop-name data yet is unaffected.
   */
  shopName?: string;
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
  shopName,
}: Props) {
  /**
   * The row the pointer is over.
   *
   * A conversation row is a ROW, not a pill, and is deliberately NOT routed
   * through `components/ui/Button` (#44) — a stack of these as uppercase
   * letter-spaced pills would look worse than the problem it fixed, and would
   * destroy the list's scannability. It gets a *stated* affordance instead of
   * an inherited one: a hover fill, a chevron that says the row opens
   * something, a 56px minimum target, a pointer cursor, and the global
   * `:focus-visible` gold ring drawn inside the row. All four are set
   * explicitly below rather than left to chance.
   *
   * Hover is state rather than a `:hover` rule because this repo styles
   * inline; `components/ui/Button.tsx` tracks its own hover exactly this way.
   */
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
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
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  // 44px is the tap floor; two lines of 11.5/12.5px type plus
                  // 24px of padding already clears it, and this states it so a
                  // one-line preview cannot drop the row under the floor.
                  minHeight: 56,
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: '1px solid var(--mr-hairline)',
                  // A gold spine for unread, so a glance is enough.
                  boxShadow: unread ? 'inset 3px 0 0 0 var(--mr-gold-500)' : 'none',
                  background:
                    hoveredId === c.id ? 'var(--mr-cream-200)' : 'transparent',
                  cursor: 'pointer',
                  opacity: closed ? 0.6 : 1,
                  fontFamily: 'Inter Tight, sans-serif',
                  // The global :focus-visible ring (globals.css) draws INSIDE
                  // the row rather than 2px outside it — the list is a scroll
                  // container with no horizontal overflow, so an outset ring
                  // on a full-width row would be clipped on both edges.
                  outlineOffset: -2,
                  transition: 'background var(--mr-dur-fast) var(--mr-ease-out)',
                }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
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
                    {c.brandName || shopName || 'MiniRue'}
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
                      borderRadius: 'var(--mr-radius-sm)',
                      padding: '1px 5px',
                    }}
                  >
                    Closed
                  </span>
                )}
                </span>
                {/* The one thing that says "this row opens something".
                    Without it a thread summary and a static message preview
                    are the same object — "no pointing on what is element as a
                    button" (#44). It slides on hover so the row answers a
                    pointer, and it is aria-hidden because the row's own text
                    is already the accessible name. */}
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: hoveredId === c.id ? 'var(--mr-gold-700)' : 'var(--mr-ink-400)',
                    transform: hoveredId === c.id ? 'translateX(2px)' : 'translateX(0)',
                    transition:
                      'transform var(--mr-dur-fast) var(--mr-ease-out), color var(--mr-dur-fast) var(--mr-ease-out)',
                  }}
                >
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </button>
            );
          })
        )}
      </div>

      <div
        style={{
          padding: 'var(--mr-sp-3)',
          borderTop: '1px solid var(--mr-hairline)',
          background: 'var(--mr-bg-raised)',
        }}
      >
        {/*
          The one action this view wants → the house `primary` button (#44).

          It was a hand-rolled ink rectangle that had drifted from the shared
          one in every measurable way: radius 8 not `--mr-radius-pill`,
          tracking 0.16em not 0.22em, and no hover, no press, no sweep, no
          disabled treatment at all. Full width because it is the only control
          in this footer strip and a centred pill in an otherwise empty bar
          reads as an afterthought.
        */}
        <Button
          variant="primary"
          size="sm"
          onClick={onNew}
          style={{ width: '100%', minHeight: 44 }}
          traceId="PG-STOREFRONT-SUPPORT-001::EL-BTN-new-conversation"
        >
          New conversation
        </Button>
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

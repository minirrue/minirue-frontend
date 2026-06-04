'use client';

import { useState, useTransition } from 'react';
import type { Notification } from '@/lib/api/notifications';
import { apiMarkNotificationRead, apiMarkAllNotificationsRead } from '@/lib/api/notifications';

export default function NotificationsClient({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  const unreadCount = items.filter((n) => !n.isRead).length;

  function markRead(id: string) {
    startTransition(async () => {
      try {
        await apiMarkNotificationRead(id);
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
      } catch { /* non-critical */ }
    });
  }

  function markAll() {
    startTransition(async () => {
      try {
        await apiMarkAllNotificationsRead();
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch { /* non-critical */ }
    });
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--mr-sp-5)',
          background: 'var(--mr-bg-raised)',
          border: '1px solid var(--mr-border)',
          borderRadius: 'var(--mr-radius-md)',
          fontSize: 'var(--mr-text-sm)',
          color: 'var(--mr-fg-3)',
          textAlign: 'center',
        }}
      >
        No notifications yet.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--mr-sp-4)' }}>
        <span style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', fontFamily: 'var(--mr-font-label)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
        </span>
        {unreadCount > 0 && (
          <button
            onClick={markAll}
            disabled={pending}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--mr-text-xs)',
              fontFamily: 'var(--mr-font-label)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--mr-accent)',
              padding: 0,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((n) => (
          <div
            key={n.id}
            style={{
              padding: '14px 18px',
              background: n.isRead ? 'var(--mr-bg-raised)' : 'var(--mr-bg-elevated, var(--mr-bg-raised))',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-sm)',
              display: 'flex',
              gap: 'var(--mr-sp-3)',
              alignItems: 'flex-start',
              opacity: n.isRead ? 0.7 : 1,
            }}
          >
            {!n.isRead && (
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--mr-accent)',
                  flexShrink: 0,
                  marginTop: 5,
                }}
              />
            )}
            {n.isRead && <div style={{ width: 7, flexShrink: 0 }} />}

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--mr-text-sm)', fontWeight: n.isRead ? 400 : 500, color: 'var(--mr-fg)', marginBottom: 3 }}>
                {n.title}
              </div>
              <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)' }}>
                {n.body}
              </div>
              <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', marginTop: 4 }}>
                {new Date(n.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>

            {!n.isRead && (
              <button
                onClick={() => markRead(n.id)}
                disabled={pending}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--mr-text-xs)',
                  color: 'var(--mr-fg-4)',
                  padding: 0,
                  flexShrink: 0,
                  fontFamily: 'var(--mr-font-label)',
                }}
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

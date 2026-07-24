'use client';

import React from 'react';

interface ChatButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export default function ChatButton({ onClick, hasUnread = false }: ChatButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  // On mobile, sit a little higher (vh-based) so the button clears the very bottom edge.
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return (
    <button
      aria-label="Open live support chat"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'fixed', bottom: isMobile ? 'calc(24px + 5.5vh)' : 24, right: 24, zIndex: 200,
        width: 52, height: 52, borderRadius: '50%',
        background: hovered ? 'var(--mr-ink-700)' : 'var(--mr-ink-900)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(238,230,209,0.14)',
        boxShadow: hovered
          ? '0 8px 32px rgba(11,11,11,0.4), 0 0 0 8px rgba(11,11,11,0.08)'
          : '0 4px 20px rgba(11,11,11,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.92)' : hovered ? 'scale(1.06)' : 'scale(1)',
        transition: pressed
          ? 'transform 80ms cubic-bezier(0.4,0,0.2,1)'
          : 'transform 260ms cubic-bezier(0.16,1,0.3,1), background 200ms, box-shadow 260ms',
        willChange: 'transform',
      }}
    >
      <svg
        width={22} height={22} viewBox="0 0 24 24" fill="none"
        stroke="var(--mr-cream-100)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>

      {hasUnread && (
        <span
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 9, height: 9, borderRadius: '50%',
            background: 'var(--mr-gold-400)',
            border: '2px solid var(--mr-ink-900)',
            animation: 'mr-breath 2.4s cubic-bezier(0.25,0.46,0.45,0.94) infinite',
          }}
        />
      )}
    </button>
  );
}

'use client';

import React from 'react';

export interface ChatDisplayMessage {
  id: string;
  from: 'agent' | 'cx';
  name: string;
  text: string;
  time: string;
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatDisplayMessage[];
  onSend: (text: string) => void;
  sending?: boolean;
  inputDisabled?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  /** Rendered above the message list, e.g. the subject picker. */
  topSlot?: React.ReactNode;
  /** Rendered instead of the text input, e.g. the guest contact form. */
  bottomSlot?: React.ReactNode;
}

export default function ChatPanel({
  open,
  onClose,
  messages,
  onSend,
  sending = false,
  inputDisabled = false,
  headerTitle = 'MiniRue Support',
  headerSubtitle = 'Typically replies in under 2 minutes',
  topSlot,
  bottomSlot,
}: ChatPanelProps) {
  const [input, setInput] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // On mobile, lift the panel slightly when a field is focused so the on-screen
  // keyboard doesn't cover the input/send button. Uses vh so it scales per device.
  const [isMobile, setIsMobile] = React.useState(false);
  const [fieldFocused, setFieldFocused] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  const keyboardLift = open && isMobile && fieldFocused;
  const isFormField = (el: EventTarget | null) =>
    el instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);

  React.useEffect(() => {
    if (open && !bottomSlot && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 380);
    }
  }, [open, bottomSlot]);

  React.useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollTop = bottomRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = () => {
    const txt = input.trim();
    if (!txt || inputDisabled || sending) return;
    setInput('');
    onSend(txt);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live support chat"
      aria-live="polite"
      onFocusCapture={(e) => { if (isFormField(e.target)) setFieldFocused(true); }}
      onBlurCapture={(e) => { if (isFormField(e.target)) setFieldFocused(false); }}
      style={{
        position: 'fixed', bottom: 'calc(88px + 4vh)', right: 24, zIndex: 199,
        width: 'min(360px, calc(100vw - 48px))',
        height: 'min(560px, calc(100vh - 140px - 4vh))',
        background: 'rgba(253,251,245,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--mr-hairline)',
        borderRadius: 16,
        boxShadow: '0 24px 60px rgba(11,11,11,0.22), 0 4px 16px rgba(11,11,11,0.08)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: open ? `translateY(${keyboardLift ? '-4.5vh' : '0'}) scale(1)` : 'translateY(24px) scale(0.94)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'transform 380ms cubic-bezier(0.16,1,0.3,1), opacity 260ms cubic-bezier(0.16,1,0.3,1)',
        transformOrigin: 'bottom right',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 18px', background: 'var(--mr-ink-900)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mr-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: 'var(--mr-cream-100)', flexShrink: 0 }}>
          MR
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Inter Tight, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--mr-cream-100)', lineHeight: 1.2 }}>{headerTitle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', animation: 'mr-breath 3s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, color: 'rgba(238,230,209,0.55)' }}>{headerSubtitle}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{ background: 'rgba(238,230,209,0.1)', border: 0, borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--mr-cream-100)', transition: 'background 180ms' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(238,230,209,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(238,230,209,0.1)')}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>

      {topSlot}

      {/* Messages */}
      <div
        ref={bottomRef}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'none' }}
      >
        {messages.length === 0 && (
          <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-400)', textAlign: 'center', padding: '24px 8px' }}>
            Send us a message and our team will get back to you shortly.
          </div>
        )}
        {messages.map((msg, i) => {
          const isAgent = msg.from === 'agent';
          return (
            <div
              key={msg.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-start' : 'flex-end', animation: 'mr-fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background: isAgent ? 'var(--mr-cream-200)' : 'var(--mr-ink-900)', color: isAgent ? 'var(--mr-ink-900)' : 'var(--mr-cream-100)', fontFamily: 'Inter Tight, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
                {msg.text}
              </div>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', marginTop: 3, padding: '0 2px' }}>
                {msg.name} · {msg.time}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input or slot (e.g. guest contact form) */}
      {bottomSlot ?? (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--mr-hairline)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--mr-cream-100)' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type a message…"
            aria-label="Type your message"
            disabled={inputDisabled}
            style={{ flex: 1, border: '1px solid var(--mr-hairline)', borderRadius: 8, padding: '9px 12px', outline: 'none', fontFamily: 'Inter Tight, sans-serif', fontSize: 13, color: 'var(--mr-ink-900)', background: 'var(--mr-cream-200)', transition: 'border-color 200ms' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--mr-gold-400)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--mr-hairline)')}
          />
          <button
            onClick={send}
            aria-label="Send message"
            disabled={inputDisabled || sending}
            style={{ width: 36, height: 36, borderRadius: '50%', background: input.trim() ? 'var(--mr-ink-900)' : 'var(--mr-cream-300)', border: 0, cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 200ms cubic-bezier(0.16,1,0.3,1), transform 160ms', transform: input.trim() ? 'scale(1)' : 'scale(0.9)', flexShrink: 0 }}
            onMouseEnter={(e) => { if (input.trim()) e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = input.trim() ? 'scale(1)' : 'scale(0.9)'; }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={input.trim() ? 'var(--mr-cream-100)' : 'var(--mr-ink-400)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      )}

      {!bottomSlot && (
        <div style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', borderTop: '1px solid var(--mr-hairline)', background: 'var(--mr-cream-100)' }}>
          Typically replies in under 2 minutes · MiniRue Maison
        </div>
      )}
    </div>
  );
}

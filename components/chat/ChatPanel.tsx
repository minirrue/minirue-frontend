'use client';

import React from 'react';

interface Message {
  from: 'agent' | 'cx';
  name: string;
  text: string;
  time: string;
}

const CHAT_MOCK: Message[] = [
  { from: 'agent', name: 'Sophie M.', text: 'Bonjour! Welcome to MiniRue. How can I help you today?', time: '10:42' },
  { from: 'cx',    name: 'You',       text: "Hi! I'm looking for a fragrance for my partner — she loves rose and sandalwood.", time: '10:43' },
  { from: 'agent', name: 'Sophie M.', text: 'Perfect choice — I would suggest Absolue Rose or Blanc Amande. Both have beautiful warmth.', time: '10:43' },
  { from: 'agent', name: 'Sophie M.', text: 'Would you like me to send complimentary samples with your next order?', time: '10:44' },
];

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ChatPanel({ open, onClose }: ChatPanelProps) {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>(CHAT_MOCK);
  const [typing, setTyping] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 380);
    }
  }, [open]);

  React.useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollTop = bottomRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = () => {
    const txt = input.trim();
    if (!txt) return;
    setInput('');
    setMessages((m) => [
      ...m,
      {
        from: 'cx',
        name: 'You',
        text: txt,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          from: 'agent',
          name: 'Sophie M.',
          text: "Thank you! I'll check that for you and be right back.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live support chat"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 88, right: 24, zIndex: 199,
        width: 'min(360px, calc(100vw - 48px))',
        background: 'rgba(253,251,245,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--mr-hairline)',
        borderRadius: 16,
        boxShadow: '0 24px 60px rgba(11,11,11,0.22), 0 4px 16px rgba(11,11,11,0.08)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: open ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.94)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'transform 380ms cubic-bezier(0.34,1.56,0.64,1), opacity 260ms cubic-bezier(0.16,1,0.3,1)',
        transformOrigin: 'bottom right',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 18px', background: 'var(--mr-ink-900)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mr-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: 'var(--mr-cream-100)', flexShrink: 0 }}>
          SM
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Inter Tight, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--mr-cream-100)', lineHeight: 1.2 }}>Sophie M.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', animation: 'mr-breath 3s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, color: 'rgba(238,230,209,0.55)' }}>MiniRue Support · Online</span>
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

      {/* Messages */}
      <div
        ref={bottomRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, scrollbarWidth: 'none' }}
      >
        {messages.map((msg, i) => {
          const isAgent = msg.from === 'agent';
          return (
            <div
              key={i}
              style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-start' : 'flex-end', animation: 'mr-fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${i * 40}ms` }}
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
        {typing && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'var(--mr-cream-200)', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mr-ink-400)', animation: 'mr-breath 1s ease-in-out infinite', animationDelay: `${i * 150}ms`, display: 'inline-block' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--mr-hairline)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--mr-cream-100)' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          aria-label="Type your message"
          style={{ flex: 1, border: '1px solid var(--mr-hairline)', borderRadius: 8, padding: '9px 12px', outline: 'none', fontFamily: 'Inter Tight, sans-serif', fontSize: 13, color: 'var(--mr-ink-900)', background: 'var(--mr-cream-200)', transition: 'border-color 200ms' }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--mr-gold-400)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--mr-hairline)')}
        />
        <button
          onClick={send}
          aria-label="Send message"
          style={{ width: 36, height: 36, borderRadius: '50%', background: input.trim() ? 'var(--mr-ink-900)' : 'var(--mr-cream-300)', border: 0, cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 200ms cubic-bezier(0.34,1.56,0.64,1), transform 160ms', transform: input.trim() ? 'scale(1)' : 'scale(0.9)', flexShrink: 0 }}
          onMouseEnter={(e) => { if (input.trim()) e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = input.trim() ? 'scale(1)' : 'scale(0.9)'; }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={input.trim() ? 'var(--mr-cream-100)' : 'var(--mr-ink-400)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', borderTop: '1px solid var(--mr-hairline)', background: 'var(--mr-cream-100)' }}>
        Typically replies in under 2 minutes · MiniRue Maison
      </div>
    </div>
  );
}

'use client';

import React from 'react';

export interface ChatAttachment {
  url: string;
  kind: 'image';
}

export interface ChatDisplayMessage {
  id: string;
  from: 'agent' | 'cx';
  name: string;
  text: string;
  time: string;
  attachments?: ChatAttachment[];
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatDisplayMessage[];
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  sending?: boolean;
  inputDisabled?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  /** Status dot color; defaults to green (online) when unset. */
  statusColor?: string;
  /** Rendered above the message list, e.g. the subject picker. */
  topSlot?: React.ReactNode;
  /** Rendered instead of the text input, e.g. the guest contact form. */
  bottomSlot?: React.ReactNode;
  /** Upload a file, returning its hosted URL. Enables paste/attach in the composer. */
  onUpload?: (file: File) => Promise<{ url: string }>;
}

export default function ChatPanel({
  open,
  onClose,
  messages,
  onSend,
  sending = false,
  inputDisabled = false,
  headerTitle = 'MiniRue Support',
  headerSubtitle,
  statusColor = '#4CAF50',
  topSlot,
  bottomSlot,
  onUpload,
}: ChatPanelProps) {
  const [input, setInput] = React.useState('');
  const [pendingAttachments, setPendingAttachments] = React.useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
    if ((!txt && pendingAttachments.length === 0) || inputDisabled || sending) return;
    setInput('');
    const attachments = pendingAttachments;
    setPendingAttachments([]);
    onSend(txt, attachments.length > 0 ? attachments : undefined);
  };

  const uploadFiles = React.useCallback(
    async (files: File[]) => {
      if (!onUpload || files.length === 0) return;
      setUploading(true);
      try {
        const results = await Promise.all(
          files.map(async (file) => {
            try {
              const { url } = await onUpload(file);
              return { url, kind: 'image' as const };
            } catch {
              return null;
            }
          }),
        );
        const ok = results.filter((r): r is ChatAttachment => r !== null);
        if (ok.length > 0) setPendingAttachments((prev) => [...prev, ...ok]);
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!onUpload) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length > 0) {
      e.preventDefault();
      void uploadFiles(imageFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void uploadFiles(files);
    e.target.value = '';
  };

  const removeAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url));
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
        position: 'fixed', bottom: isMobile ? 'calc(80px + 6.5vh)' : 88, right: 24, zIndex: 199,
        width: 'min(360px, calc(100vw - 48px))',
        height: isMobile ? 'min(560px, calc(100vh - 140px - 6.5vh))' : 'min(560px, calc(100vh - 140px))',
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
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, animation: 'mr-breath 3s ease-in-out infinite' }} />
            {headerSubtitle && (
              <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, color: 'rgba(238,230,209,0.55)' }}>{headerSubtitle}</span>
            )}
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
                {msg.text && <div>{msg.text}</div>}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: msg.text ? 8 : 0 }}>
                    {msg.attachments.map((att) => (
                      <a key={att.url} href={att.url} target="_blank" rel="noreferrer noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={att.url}
                          alt="Attachment"
                          style={{ maxWidth: 200, maxHeight: 200, borderRadius: 10, display: 'block', objectFit: 'cover' }}
                        />
                      </a>
                    ))}
                  </div>
                )}
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
        <div style={{ borderTop: '1px solid var(--mr-hairline)', background: 'var(--mr-cream-100)' }}>
          {pendingAttachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px 0 12px' }}>
              {pendingAttachments.map((att) => (
                <div key={att.url} style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.url} alt="Pending attachment" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                  <button
                    onClick={() => removeAttachment(att.url)}
                    aria-label="Remove attachment"
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
            {onUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach image"
                  disabled={inputDisabled || uploading}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid var(--mr-hairline)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--mr-ink-400)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
              </>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              onPaste={handlePaste}
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
              style={{ width: 36, height: 36, borderRadius: '50%', background: (input.trim() || pendingAttachments.length > 0) ? 'var(--mr-ink-900)' : 'var(--mr-cream-300)', border: 0, cursor: (input.trim() || pendingAttachments.length > 0) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 200ms cubic-bezier(0.16,1,0.3,1), transform 160ms', transform: (input.trim() || pendingAttachments.length > 0) ? 'scale(1)' : 'scale(0.9)', flexShrink: 0 }}
              onMouseEnter={(e) => { if (input.trim() || pendingAttachments.length > 0) e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = (input.trim() || pendingAttachments.length > 0) ? 'scale(1)' : 'scale(0.9)'; }}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={(input.trim() || pendingAttachments.length > 0) ? 'var(--mr-cream-100)' : 'var(--mr-ink-400)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!bottomSlot && (
        <div style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', borderTop: '1px solid var(--mr-hairline)', background: 'var(--mr-cream-100)' }}>
          {headerSubtitle ?? 'We usually reply soon'} · MiniRue Maison
        </div>
      )}
    </div>
  );
}

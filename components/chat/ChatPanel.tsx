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
  /** Client-only optimistic-send status; only meaningful for `from: 'cx'` bubbles. */
  status?: 'sending' | 'sent' | 'failed';
  /** Client-only key used to retry a failed optimistic send. */
  tempId?: string;
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
  /** Conversation id, shown as a small copyable reference once a thread exists. */
  referenceId?: string;
  /** Retry a failed optimistic send, keyed by the message's `tempId`. */
  onRetry?: (tempId: string) => void;
  /**
   * Replaces the message list AND the composer entirely — used for the
   * conversation list and the new-conversation form, which are whole views rather
   * than something layered over a thread. The header, close button and panel
   * animation are kept, so switching views does not feel like a new window.
   */
  body?: React.ReactNode;
  /** A back affordance in the header, e.g. returning from a thread to the list. */
  onBack?: () => void;
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
  referenceId,
  onRetry,
  body,
  onBack,
}: ChatPanelProps) {
  const [input, setInput] = React.useState('');
  const [refCopied, setRefCopied] = React.useState(false);
  const copyReferenceId = React.useCallback(() => {
    if (!referenceId) return;
    navigator.clipboard?.writeText(referenceId).then(
      () => {
        setRefCopied(true);
        window.setTimeout(() => setRefCopied(false), 1600);
      },
      () => {
        // Clipboard permission denied or unavailable; silently no-op.
      },
    );
  }, [referenceId]);
  const [pendingAttachments, setPendingAttachments] = React.useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  /** False until the thread has been auto-scrolled once for this opening. */
  const openedRef = React.useRef(false);
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
    const el = bottomRef.current;
    if (!el) return;
    // Only follow the newest message when the reader is already at the bottom
    // (or the panel just opened). Polling used to snap the thread back down
    // every few seconds, so scrolling up to read history was impossible.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const shouldFollow = !openedRef.current || distanceFromBottom < 80;
    openedRef.current = true;
    if (!shouldFollow) return;

    const toBottom = () => { el.scrollTop = el.scrollHeight; };
    // Run again after the next frame and a short delay so layout +
    // late-loading images still land us at the bottom (opening a thread must
    // start at the latest, not the top).
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    const t = window.setTimeout(toBottom, 80);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t); };
  }, [messages, open]);

  // Reset the "already opened" latch each time the panel closes, so reopening
  // always jumps to the newest message again.
  React.useEffect(() => {
    if (!open) openedRef.current = false;
  }, [open]);

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
        position: 'fixed', bottom: isMobile ? 'calc(78px + 6.5vh)' : 80, right: 24, zIndex: 199,
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
        {/* Back replaces the monogram rather than sitting beside it: with both, the
            header on a small phone had no room left for the title. */}
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Back to conversations"
            style={{ background: 'rgba(238,230,209,0.1)', border: 0, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--mr-cream-100)', flexShrink: 0 }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mr-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: 'var(--mr-cream-100)', flexShrink: 0 }}>
            MR
          </div>
        )}
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

      {body ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} data-lenis-prevent>
          {body}
        </div>
      ) : (
        <>
      {topSlot}

      {/* Messages */}
      <div
        ref={bottomRef}
        // Lenis runs in `root` mode with smoothWheel, so it swallows wheel
        // events for the whole document — including this panel, which is why
        // the thread would not scroll with a mouse on desktop. This attribute
        // is Lenis's opt-out for nested scrollers.
        data-lenis-prevent
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'none' }}
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
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', marginTop: 3, padding: '0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{msg.name} · {msg.time}</span>
                {!isAgent && msg.status === 'sending' && (
                  <span style={{ opacity: 0.7 }}>Sending…</span>
                )}
                {!isAgent && msg.status === 'failed' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#C0392B' }}>
                    Failed ·
                    <button
                      onClick={() => msg.tempId && onRetry?.(msg.tempId)}
                      style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: '#C0392B', textDecoration: 'underline', font: 'inherit' }}
                    >
                      Retry
                    </button>
                  </span>
                )}
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
              // Ignore the Enter that Android fires while the IME is still composing —
              // that phantom event is what injects a stray character on keyboard dismiss.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !(e.nativeEvent as { isComposing?: boolean }).isComposing) send();
              }}
              onPaste={handlePaste}
              placeholder="Type a message…"
              aria-label="Type your message"
              disabled={inputDisabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              enterKeyHint="send"
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
          {referenceId && (
            <div style={{ marginTop: 3 }}>
              <button
                onClick={copyReferenceId}
                aria-label="Copy chat reference id"
                title="Click to copy"
                style={{
                  background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 9.5, color: 'var(--mr-ink-400)',
                  opacity: 0.7, letterSpacing: 0.2,
                }}
              >
                {refCopied ? 'Copied' : `Ref: ${referenceId}`}
              </button>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}

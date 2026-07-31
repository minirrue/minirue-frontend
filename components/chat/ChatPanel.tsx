'use client';

import React from 'react';
import { CHAT_BUTTON_SIZE, useChatButtonPosition } from '@/lib/hooks/useChatButtonPosition';
import GenericAvatarIcon from '@/components/ui/GenericAvatarIcon';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';

/** Breathing room between the chat button and the panel it opens. Small on
 *  purpose: the panel should read as belonging to the button, not floating
 *  somewhere near it. */
const PANEL_GAP = 8;

export interface ChatAttachment {
  url: string;
  kind: 'image';
  /**
   * Client-only: the exact bytes this session just uploaded, when this
   * attachment is being shown on a message the CX just sent. Lets
   * `UploadPreviewImage` show them immediately and swap to `url` only once
   * it has loaded in the background — the same cold-cache-first-request
   * problem as everywhere else in this app, and the same fix. Never present
   * on a message loaded from the server (someone else's earlier upload).
   */
  localFile?: File;
}

/**
 * A file picked/pasted but not yet sent. Tracks its own upload lifecycle so
 * the composer can show it as accepted, uploading, ready, or failed — before
 * this, nothing in the UI said any of that, so a shopper who picked a photo
 * had no idea it had even been received.
 */
interface PendingAttachment {
  id: string;
  file: File;
  /** An object URL for `file` — the bytes the browser already has, shown
   *  immediately rather than waiting on the upload. Revoked the moment this
   *  attachment leaves the composer (removed, or sent — a sent message gets
   *  its own, independent object URL from the same `file` via
   *  `UploadPreviewImage`, so nothing is left referencing this one). */
  localUrl: string;
  /** Set once the upload resolves. */
  remoteUrl?: string;
  status: 'uploading' | 'ready' | 'failed';
}

export interface ChatDisplayMessage {
  id: string;
  from: 'agent' | 'cx';
  name: string;
  /** Resolved server-side: personal avatar -> (COLLAB) brand logo -> null.
   * Null/undefined renders the generic person icon — never an initial
   * letter, never a broken image, never an empty gap. */
  senderAvatarUrl?: string | null;
  text: string;
  time: string;
  attachments?: ChatAttachment[];
  /** Client-only optimistic-send status; only meaningful for `from: 'cx'` bubbles. */
  status?: 'sending' | 'sent' | 'failed';
  /** Client-only key used to retry a failed optimistic send. */
  tempId?: string;
}

/** Per-message sender avatar: the resolved photo/brand logo when the backend
 * found one, else the generic person icon. Never an initial letter, and never
 * a broken-image box — a load failure falls back to the same icon. */
function MessageAvatar({
  url,
  name,
  // The header reuses this component for the shop logo (Task #33), so the
  // fallback's test id is a prop rather than a constant — with a single
  // hard-coded id, a query for "the message avatar fallback" silently matched
  // the header's too and every such assertion became ambiguous.
  fallbackTestId = 'msg-avatar-initial',
}: {
  url?: string | null;
  name: string;
  fallbackTestId?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => setErrored(false), [url]);
  if (url && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        onError={() => setErrored(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
      />
    );
  }
  return (
    <span
      data-testid={fallbackTestId}
      aria-label={`${name} — no photo`}
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Cormorant Garamond, serif', fontSize: 10, fontWeight: 600, color: 'var(--mr-ink-700)',
      }}
    >
      {/* The generic silhouette, not an initial. An initial in a circle is a
          placeholder that looks like a decision; the owner asked for one
          consistent person icon wherever a photo is missing, matching every
          other avatar slot across the two apps. */}
      <GenericAvatarIcon />
    </span>
  );
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
  /**
   * The shop's own uploaded logo (`store_settings` brand logo), shown as the
   * header's avatar. Null/undefined renders the generic person icon — never
   * the "MR" monogram this replaced, and never an initial letter.
   */
  shopAvatarUrl?: string | null;
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
  shopAvatarUrl,
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
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);
  // Derived, not separately tracked — a boolean that can drift out of sync
  // with the array it describes is exactly how "no upload feedback" bugs
  // like this one happen in the first place.
  const uploading = pendingAttachments.some((a) => a.status === 'uploading');
  const attachmentCounterRef = React.useRef(0);
  // Mirrors `pendingAttachments` on every render so the unmount cleanup below
  // can revoke whatever object URLs are still outstanding without closing
  // over a stale empty array from mount.
  const pendingAttachmentsRef = React.useRef<PendingAttachment[]>(pendingAttachments);
  pendingAttachmentsRef.current = pendingAttachments;
  React.useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.localUrl));
    };
  }, []);

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

  // ── Anchor to the (possibly dragged) chat button (W4a.3) ─────────────────
  // `ChatButton` and `ChatPanel` are siblings under `SupportWidget.tsx` — a
  // file this task does not own — so they cannot be wired together with a
  // prop. `useChatButtonPosition` is the shared store both read/write
  // instead. `null` here means "the button is still at its untouched default
  // corner" (true on the server, and on the client until the store is
  // hydrated or a drag settles), so this recomputes the ORIGINAL fixed
  // bottom/right anchor below rather than reaching for `window` at all —
  // `window.innerWidth`/`innerHeight` are only read in the branch that can
  // only run once a real drag has settled, which is client-only by
  // construction.
  const buttonPos = useChatButtonPosition();
  const anchor = React.useMemo(() => {
    if (!buttonPos) return null;
    const viewportH = window.innerHeight;
    const margin = 16;
    const gap = 12;
    const estimatedHeight = Math.min(560, viewportH - 2 * margin);

    const spaceAbove = buttonPos.y;
    const spaceBelow = viewportH - (buttonPos.y + CHAT_BUTTON_SIZE);
    const openAbove = spaceAbove >= estimatedHeight + gap || spaceAbove >= spaceBelow;

    const horizontal: React.CSSProperties =
      buttonPos.edge === 'left' ? { left: margin, right: 'auto' } : { right: margin, left: 'auto' };

    // The available run of vertical space on whichever side the panel opens
    // toward, expressed as a `calc()` so it stays correct if the viewport
    // resizes while the panel is open — `min(560px, …)` mirrors the fixed
    // corner's own sizing below rather than always filling every last px.
    const available = openAbove
      ? `calc(100vh - ${Math.max(margin, viewportH - buttonPos.y + gap)}px - ${margin}px)`
      : `calc(100vh - ${buttonPos.y + CHAT_BUTTON_SIZE + gap}px - ${margin}px)`;

    return openAbove
      ? {
          ...horizontal,
          bottom: Math.max(margin, viewportH - buttonPos.y + gap),
          top: 'auto',
          heightCalc: `min(560px, ${available})`,
        }
      : {
          ...horizontal,
          top: buttonPos.y + CHAT_BUTTON_SIZE + gap,
          bottom: 'auto',
          heightCalc: `min(560px, ${available})`,
        };
  }, [buttonPos]);

  React.useEffect(() => {
    if (open && !bottomSlot && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 380);
    }
  }, [open, bottomSlot]);

  // The panel's height with no keyboard involved — shrunk further (see the
  // `height` style below) rather than translated when the on-screen keyboard
  // opens, so the panel never drifts away from the chat button.
  const baseHeightExpr = anchor
    ? anchor.heightCalc
    : isMobile
      ? 'min(560px, calc(100vh - 140px - 6.5vh))'
      : 'min(560px, calc(100vh - 140px))';

  // ── Scroll-to-bottom ──────────────────────────────────────────────────
  //
  // Three things must all land at the newest message: sending, opening a
  // conversation (including the bootstrap auto-resume), and switching between
  // conversations. A fourth — an ordinary incoming message while the reader
  // is already at the bottom — should follow too, but must NEVER yank someone
  // who scrolled up to read history back down.
  //
  // `pendingScrollRef` is a one-shot instruction consumed the next time
  // `messages` actually has content: 'instant' for a fresh open/switch (a
  // smooth slide up from the top of a long thread reads as a bug, not a
  // feature), 'smooth' for the reader's own send. `pinnedToBottomRef` tracks
  // whether the reader is currently at the bottom, kept current by a scroll
  // listener below, and is what an ordinary incoming message consults.
  const pendingScrollRef = React.useRef<'instant' | 'smooth' | null>(null);
  const pinnedToBottomRef = React.useRef(true);
  const hasBody = Boolean(body);

  const scrollToBottom = React.useCallback((mode: 'instant' | 'smooth') => {
    const el = bottomRef.current;
    if (!el) return;
    // `Element.scrollTo` does not exist in this project's jsdom test
    // environment (confirmed: calling it throws `TypeError: el.scrollTo is
    // not a function`), and it is a reasonable stand-in for any other
    // environment missing it too — falls back to the instant jump rather
    // than throwing and aborting the whole effect.
    if (mode === 'smooth' && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      return;
    }
    // Instant: fire now AND after the next frame/a short delay, so layout
    // that hasn't settled yet (fonts, a just-mounted container) still lands
    // us exactly at the bottom rather than close to it. Repeating an instant
    // jump is harmless — it is a no-op once already at the bottom.
    el.scrollTop = el.scrollHeight;
    const raf = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    const t = window.setTimeout(() => { el.scrollTop = el.scrollHeight; }, 80);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t); };
  }, []);

  // A different conversation is now on screen — a switch between threads, a
  // tap into one from the list, or the bootstrap resume landing on the
  // widget's first open. Closing always resets the key so the NEXT opening
  // (of anything) is treated as fresh too.
  //
  // Deliberately a LAYOUT effect, and deliberately declared ABOVE the effect
  // that consumes `pendingScrollRef`: React runs every layout effect before
  // any passive one, so as a passive effect this used to set the instruction
  // AFTER its consumer had already run for that commit. On the very first
  // commit the consumer therefore saw `null`, and the 'instant' it then set
  // sat there unconsumed until the NEXT message batch arrived — where it
  // force-scrolled a reader who had since scrolled up, the exact yank the
  // pinned-to-bottom tracking below exists to prevent.
  const sessionKeyRef = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    if (!open) {
      sessionKeyRef.current = null;
      return;
    }
    const key = `${referenceId ?? 'none'}:${hasBody ? 'body' : 'thread'}`;
    if (sessionKeyRef.current !== key) {
      sessionKeyRef.current = key;
      pendingScrollRef.current = 'instant';
      pinnedToBottomRef.current = true;
    }
  }, [open, referenceId, hasBody]);

  // Fires after the DOM has committed the new message list — a scroll issued
  // before layout does nothing. Skips an EMPTY batch entirely (nothing to
  // scroll to yet) rather than consuming a pending 'instant' jump on it: a
  // resumed conversation clears to `[]` before its real messages arrive, and
  // without this guard that empty flash would eat the instant jump, leaving
  // the real content to slide in smoothly from the top instead.
  React.useLayoutEffect(() => {
    if (!bottomRef.current || messages.length === 0) return;
    const pending = pendingScrollRef.current;
    if (pending) {
      pendingScrollRef.current = null;
      pinnedToBottomRef.current = true;
      return scrollToBottom(pending);
    }
    if (pinnedToBottomRef.current) return scrollToBottom('smooth');
  }, [messages, scrollToBottom]);

  // Keeps `pinnedToBottomRef` current so the effect above knows whether an
  // ordinary incoming message should follow. Re-attaches whenever the
  // scrollable container mounts/unmounts (the thread view toggles with
  // `body`) — the same node otherwise persists across a conversation switch.
  React.useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      pinnedToBottomRef.current = distance < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasBody]);

  // An attachment's real dimensions can arrive after the list already
  // painted (its own load, or `UploadPreviewImage` swapping from a local
  // preview to the confirmed remote copy) and push the bottom out of view.
  // Only corrects for a reader who was AT the bottom — never for one who
  // scrolled up, which would be the exact yank this whole scheme exists to
  // avoid.
  const handleAttachmentSettled = React.useCallback(() => {
    if (pinnedToBottomRef.current) scrollToBottom('instant');
  }, [scrollToBottom]);

  const send = () => {
    const txt = input.trim();
    const ready = pendingAttachments.filter((a) => a.status === 'ready');
    // Blocked while anything is still uploading rather than silently
    // dropping it: sending now would either lose the picture or attach it to
    // a LATER message once it finishes, disconnected from the text it was
    // meant to go with.
    if ((!txt && ready.length === 0) || inputDisabled || sending || uploading) return;
    setInput('');
    // Hands off the `File`, not this composer's own object URL —
    // `UploadPreviewImage` makes its own from the same `File` once this
    // becomes a real message, so this one is revoked rather than kept alive
    // for nothing.
    const attachments: ChatAttachment[] = ready.map((a) => ({
      url: a.remoteUrl!,
      kind: 'image',
      localFile: a.file,
    }));
    ready.forEach((a) => URL.revokeObjectURL(a.localUrl));
    setPendingAttachments((prev) => prev.filter((a) => a.status !== 'ready'));
    pendingScrollRef.current = 'smooth';
    pinnedToBottomRef.current = true;
    onSend(txt, attachments.length > 0 ? attachments : undefined);
  };

  // Runs (and re-runs, for a retry) the actual upload for one attachment,
  // patching just that row's status/url when it settles — never touches the
  // others, so one failure never disturbs a sibling that is still uploading
  // or already ready.
  const startUpload = React.useCallback(
    (item: PendingAttachment) => {
      if (!onUpload) return;
      onUpload(item.file)
        .then(({ url }) => {
          setPendingAttachments((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, remoteUrl: url, status: 'ready' } : p)),
          );
        })
        .catch(() => {
          setPendingAttachments((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: 'failed' } : p)),
          );
        });
    },
    [onUpload],
  );

  const uploadFiles = React.useCallback(
    (files: File[]) => {
      if (!onUpload || files.length === 0) return;
      // Accepted immediately — a local preview and an "uploading" status
      // appear in the SAME tick the file is picked/pasted, before any
      // network round trip even starts.
      const items: PendingAttachment[] = files.map((file) => ({
        id: `att-${++attachmentCounterRef.current}-${Date.now()}`,
        file,
        localUrl: URL.createObjectURL(file),
        status: 'uploading',
      }));
      setPendingAttachments((prev) => [...prev, ...items]);
      items.forEach(startUpload);
    },
    [onUpload, startUpload],
  );

  const retryAttachment = React.useCallback(
    (item: PendingAttachment) => {
      setPendingAttachments((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: 'uploading' } : p)),
      );
      startUpload(item);
    },
    [startUpload],
  );

  /** A transient "couldn't read that paste" notice — shown only when the
   *  paste event fired but handed over nothing at all (see `handlePaste`),
   *  never for an ordinary plain-text paste, which this leaves untouched. */
  const [pasteHint, setPasteHint] = React.useState(false);
  const pasteHintTimeoutRef = React.useRef<number | null>(null);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onUpload) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length > 0) {
      e.preventDefault();
      // Exactly the same upload path as the attach button — same accepted /
      // uploading / ready / failed states, same thumbnail.
      uploadFiles(imageFiles);
      return;
    }
    // Nothing at all came through with the paste — some mobile browsers
    // withhold `clipboardData` entirely for content they won't hand over,
    // rather than firing a normal paste with file items (the composer used
    // to be a plain single-line `<input>`, which Chrome for Android never
    // allows an image paste into at all — a `<textarea>` does not have that
    // restriction, so this is now the rarer genuine-failure case, not the
    // common one). An ordinary plain-text paste always has at least one
    // clipboard item, so this never fires for that.
    if (items.length === 0) {
      setPasteHint(true);
      if (pasteHintTimeoutRef.current) window.clearTimeout(pasteHintTimeoutRef.current);
      pasteHintTimeoutRef.current = window.setTimeout(() => setPasteHint(false), 3200);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) uploadFiles(files);
    e.target.value = '';
  };

  const removeAttachment = (item: PendingAttachment) => {
    URL.revokeObjectURL(item.localUrl);
    setPendingAttachments((prev) => prev.filter((a) => a.id !== item.id));
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
        position: 'fixed',
        zIndex: 199,
        // `anchor` is set once the chat button has moved from its untouched
        // corner (W4a.3) — it supplies its own bottom/top + left/right (and,
        // via `heightCalc` below, its own height) so the panel opens from
        // wherever the button now lives and can never spill off screen when
        // the button is tucked at an edge. `null` (default corner, or
        // pre-hydration) falls back to the original fixed anchor, raised to
        // match ChatButton.tsx's new resting spot (`bottom: calc(84px +
        // env(safe-area-inset-bottom))`, clear of the PDP sticky buy bar) by
        // the same ~60px the button itself moved up by.
        ...(anchor
          ? { left: anchor.left, right: anchor.right, top: anchor.top, bottom: anchor.bottom }
          : {
              // Sit just above the button, on every viewport. This used to be
              // `138px + 6.5vh` on phones, which is ~47px of empty air on a
              // typical handset — the panel floated away from the button that
              // opened it and read as a misplacement rather than a menu.
              //
              // Derived from the button's own geometry so the two cannot drift
              // apart again: the button rests at bottom 84px and is
              // CHAT_BUTTON_SIZE tall, so its top edge is 84 + 52 = 136px up,
              // and PANEL_GAP is the breathing room above that.
              bottom: `calc(${84 + CHAT_BUTTON_SIZE + PANEL_GAP}px + env(safe-area-inset-bottom))`,
              right: 24,
            }),
        width: 'min(360px, calc(100vw - 48px))',
        // The panel used to stay full height and `translateY` the whole box up
        // when the keyboard opens — which moves the TOP and the BOTTOM by the
        // same amount, so the gap to the (unmoved) chat button only grew. The
        // owner asked for the opposite: touching the button always, a little
        // SHORTER instead while the keyboard is up. Shrinking `height` (bottom
        // edge — and the anchor above it — never moves) does that: only the
        // top edge comes down, and the panel stays flush with the button.
        // Not in the `transition` list below (motion rule: never animate
        // `height`), so this snaps instantly with the keyboard itself rather
        // than visibly resizing.
        height: keyboardLift ? `calc(${baseHeightExpr} - 4.5vh)` : baseHeightExpr,
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
          // The shop's own uploaded logo — never the "MR" monogram this
          // replaced, and never an initial letter when there is no logo
          // (falls back to the same generic person icon as every other
          // avatar slot, via `MessageAvatar`).
          <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--mr-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mr-cream-100)', flexShrink: 0 }}>
            <MessageAvatar
              url={shopAvatarUrl}
              name={headerTitle}
              fallbackTestId="header-avatar-generic"
            />
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
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, maxWidth: '84%', flexDirection: isAgent ? 'row' : 'row-reverse' }}>
                {/* Sender avatar — the backend resolves personal avatar -> (COLLAB)
                    brand logo -> null per message; null renders as the shared
                    GenericAvatarIcon silhouette via MessageAvatar — never an
                    initial letter, a broken image, or an empty gap. */}
                <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--mr-cream-300)' }}>
                  <MessageAvatar url={msg.senderAvatarUrl} name={msg.name} />
                </div>
                <div style={{ minWidth: 0, padding: '10px 14px', borderRadius: isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background: isAgent ? 'var(--mr-cream-200)' : 'var(--mr-ink-900)', color: isAgent ? 'var(--mr-ink-900)' : 'var(--mr-cream-100)', fontFamily: 'Inter Tight, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
                  {msg.text && <div>{msg.text}</div>}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: msg.text ? 8 : 0 }}>
                      {msg.attachments.map((att) => (
                        <a key={att.url} href={att.url} target="_blank" rel="noreferrer noopener">
                          {/* The cold-cache-first-request problem this whole app has for a
                              brand-new URL: `localFile` (only ever present on a message the CX
                              just sent, this session) shows the exact bytes already in the
                              browser and swaps to `att.url` only once it has loaded in the
                              background — never a broken image while the remote copy warms up. */}
                          <UploadPreviewImage
                            src={att.url}
                            localFile={att.localFile}
                            alt="Attachment"
                            onLoad={handleAttachmentSettled}
                            style={{ maxWidth: 200, maxHeight: 200, borderRadius: 10, display: 'block', objectFit: 'cover' }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
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
            <div style={{ padding: '10px 12px 0 12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pendingAttachments.map((att) => (
                  <div key={att.id} style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                    {/* The local bytes the browser already has, shown from the instant
                        the file is picked/pasted — never waits on the network to prove
                        the file was accepted. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.localUrl}
                      alt={att.status === 'failed' ? 'Attachment failed to upload' : 'Attachment ready to send'}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block', opacity: att.status === 'failed' ? 0.4 : 1 }}
                    />
                    {att.status === 'uploading' && (
                      <span
                        aria-label="Uploading"
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 8,
                          background: 'rgba(11,11,11,0.35)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            width: 8, height: 8, borderRadius: '50%', background: 'var(--mr-cream-100)',
                            animation: 'mr-breath 1.1s ease-in-out infinite',
                          }}
                        />
                      </span>
                    )}
                    {att.status === 'failed' && (
                      <button
                        onClick={() => retryAttachment(att)}
                        aria-label="Retry upload"
                        title="Failed — tap to retry"
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 8, border: '1px dashed #C0392B',
                          background: 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#C0392B', fontSize: 9, fontWeight: 700, fontFamily: 'Inter Tight, sans-serif',
                        }}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => removeAttachment(att)}
                      aria-label="Remove attachment"
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1, zIndex: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {/* One summary line rather than per-thumbnail captions — legible at
                  48px, and mobile is the primary surface here. */}
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: uploading ? 'var(--mr-ink-400)' : pendingAttachments.some((a) => a.status === 'failed') ? '#C0392B' : 'var(--mr-ink-400)', marginTop: 4 }}>
                {uploading
                  ? `Uploading ${pendingAttachments.filter((a) => a.status === 'uploading').length > 1 ? 'images' : 'image'}…`
                  : pendingAttachments.some((a) => a.status === 'failed')
                    ? 'Upload failed — tap an image to retry, or remove it'
                    : 'Ready to send'}
              </div>
            </div>
          )}
          {pasteHint && (
            <div style={{ padding: '8px 12px 0 12px', fontFamily: 'Inter Tight, sans-serif', fontSize: 10.5, color: 'var(--mr-ink-400)' }}>
              Couldn&apos;t read that paste — try the attach button instead.
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
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              // Ignore the Enter that Android fires while the IME is still composing —
              // that phantom event is what injects a stray character on keyboard dismiss.
              // Otherwise Enter always sends and never inserts a newline — a
              // `<textarea>` (unlike the plain `<input>` this replaced) would
              // insert one by default, and this composer is single-line by design.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !(e.nativeEvent as { isComposing?: boolean }).isComposing) {
                  e.preventDefault();
                  send();
                }
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
              style={{ flex: 1, height: 36, resize: 'none', overflow: 'hidden', border: '1px solid var(--mr-hairline)', borderRadius: 8, padding: '9px 12px', outline: 'none', fontFamily: 'Inter Tight, sans-serif', fontSize: 13, lineHeight: '18px', color: 'var(--mr-ink-900)', background: 'var(--mr-cream-200)', transition: 'border-color 200ms' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--mr-gold-400)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--mr-hairline)')}
            />
            <button
              onClick={send}
              aria-label="Send message"
              disabled={inputDisabled || sending || uploading}
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
          {/* The ONE shop name (2026-07-31 owner ask) — `headerTitle` already
              carries it (see SupportWidget.tsx), never a hardcoded literal. */}
          {headerSubtitle ?? 'We usually reply soon'} · {headerTitle}
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

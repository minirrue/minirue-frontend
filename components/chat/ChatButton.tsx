'use client';

import React from 'react';
import {
  CHAT_BUTTON_SIZE,
  CHAT_BUTTON_TUCK_PX,
  chatButtonEdgeBandPx,
  clampChatButtonPosition,
  hydrateChatButtonPosition,
  reclampChatButtonPosition,
  setChatButtonPosition,
  useChatButtonPosition,
  type ChatButtonEdge,
} from '@/lib/hooks/useChatButtonPosition';
import { MessageAvatar } from '@/components/chat/ChatPanel';

/** The avatar circle inside the launcher, same size the panel header uses
 *  for the identical shop-logo slot (see ChatPanel.tsx). Smaller than the
 *  52px button itself so the launcher keeps a visible ring around it. */
const LAUNCHER_AVATAR_SIZE = 36;

interface ChatButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
  /** Whether the chat panel is open — on mobile the button lifts with the panel. */
  open?: boolean;
  /**
   * The shop's own uploaded logo — the SAME resolved URL the chat panel
   * header already renders (`SupportWidget`'s `shopAvatarUrl`), threaded
   * through rather than fetched again here. `null`/undefined renders the
   * shared `GenericAvatarIcon` (via `MessageAvatar`) — never an initial
   * letter, and never the plain chat-bubble glyph this replaced, which read
   * to the owner as "generic avatar" even with a real logo uploaded.
   */
  shopAvatarUrl?: string | null;
  /** Alt text/aria-label for the logo image; falls back to "MiniRue Support". */
  shopName?: string;
}

/** Past this many px of pointer travel, a gesture is a drag, not a tap. Small
 *  enough that a real drag is always caught; big enough that a trembling
 *  finger or a slightly-off mouse click still opens the chat. */
const DRAG_THRESHOLD_PX = 6;

/* Whether a released drag docks is decided by ONE band, `chatButtonEdgeBandPx`
 * — see useChatButtonPosition.ts. Inside it, the button docks 20% off-screen
 * against that side, leaving 80% showing; outside it, the button stays whole
 * and rests at the band's inner edge.
 *
 * This used to be a flat 80px measured against ALL FOUR edges, and the top and
 * bottom were the mistake: on a phone almost nowhere is 80px from every edge,
 * so a button dropped in the middle of the screen half-hid itself anyway. Only
 * the left and right sides can dock, so only they may decide. */

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export default function ChatButton({
  onClick,
  hasUnread = false,
  open = false,
  shopAvatarUrl = null,
  shopName = 'MiniRue Support',
}: ChatButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  // Button rests in the bottom-right corner; on mobile it lifts (vh-based) with the
  // panel only while open, so the keyboard/panel don't crowd it. Lifted via transform
  // (never animate `bottom`) so it eases smoothly.
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // ── Draggable position (W4a.3) ────────────────────────────────────────────
  // `null` means "no custom position yet" — the button renders at its
  // original CSS corner (`right: 24, bottom: calc(84px + env(safe-area-inset-
  // bottom))`, the resting spot clear of the PDP sticky buy bar) rather than a
  // JS-computed approximation of it, so `env()` keeps resolving exactly as it
  // did before this file was touched. Only once the shopper actually drags
  // the button does it switch to explicit `left`/`top` pixel coordinates.
  const storedPos = useChatButtonPosition();
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    hydrateChatButtonPosition();
  }, []);

  React.useEffect(() => {
    const onResize = () => reclampChatButtonPosition(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Live drag state — kept OUT of the shared store until the gesture ends.
  // ChatPanel only cares where the button settled, and writing to a
  // cross-component store on every pointermove would re-render it (and
  // trigger a localStorage write) 60 times a second for no benefit, since the
  // panel can't meaningfully track a bubble that's mid-drag anyway.
  const [livePos, setLivePos] = React.useState<{ x: number; y: number } | null>(null);
  // A one-shot FLIP offset: the delta between where a drag was released and
  // where it snapped, applied as a `translate()` the instant `left`/`top`
  // jump to their new value, then cleared (with a transition) a frame later
  // so the button visibly slides the rest of the way — see `settleDrag`.
  const [snapOffset, setSnapOffset] = React.useState<{ x: number; y: number } | null>(null);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);
  const dragOrigin = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const didDrag = React.useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary) return;
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOrigin.current = { x: rect.left, y: rect.top };
    didDrag.current = false;
    setPressed(true);
    // Not implemented by jsdom (no-op there); guarded rather than assumed so
    // the drag logic itself — the thing actually under test — still runs in
    // jest instead of the gesture aborting on a thrown error.
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!didDrag.current) {
      if (distance(0, 0, dx, dy) < DRAG_THRESHOLD_PX) return;
      didDrag.current = true;
    }
    const nextX = Math.min(
      Math.max(dragOrigin.current.x + dx, 0),
      window.innerWidth - CHAT_BUTTON_SIZE,
    );
    const nextY = Math.min(
      Math.max(dragOrigin.current.y + dy, 0),
      window.innerHeight - CHAT_BUTTON_SIZE,
    );
    setLivePos({ x: nextX, y: nextY });
  };

  const settleDrag = (finalPos: { x: number; y: number }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // The side is judged from the button's CENTRE against the viewport
    // midpoint, not its left corner — a wide button hanging just past the
    // midline by its corner alone would otherwise be judged by an edge that
    // is mostly off to the other side.
    const center = finalPos.x + CHAT_BUTTON_SIZE / 2;
    const edge: ChatButtonEdge = center < vw / 2 ? 'left' : 'right';

    // Dock only when the release lands inside the left/right band; otherwise
    // leave it whole, right where it was dropped.
    const distLeft = finalPos.x;
    const distRight = vw - (finalPos.x + CHAT_BUTTON_SIZE);
    const tucked = Math.min(distLeft, distRight) <= chatButtonEdgeBandPx(vw);

    const snapped = clampChatButtonPosition(
      { x: finalPos.x, y: finalPos.y, edge, tucked },
      vw,
      vh,
    );
    // Vertical position is preserved verbatim (`finalPos.y`, only re-clamped
    // to stay on screen) — only ever the horizontal side snaps.
    setChatButtonPosition(snapped);
    setLivePos(null);

    // The visual jump from the drop point to the snapped rest animates via
    // `transform` only (this project's motion rule: never `left`/`top`).
    // `left`/`top` commit to their new resting value INSTANTLY (no
    // transition — see the style below), and a `translate()` offset exactly
    // cancels that jump the instant it happens; clearing the offset one
    // frame later, WITH a transform transition enabled, is what animates the
    // button sliding from where it was dropped to where it snapped, entirely
    // on a GPU-accelerated property. `prefers-reduced-motion` needs no
    // special-casing here — the global rule in mr-tokens.css already forces
    // every transition duration to ~0, so this settles instantly for anyone
    // who has asked for less motion.
    const dx = finalPos.x - snapped.x;
    const dy = finalPos.y - snapped.y;
    if (dx !== 0 || dy !== 0) {
      setSnapOffset({ x: dx, y: dy });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSnapOffset(null));
      });
    } else {
      setSnapOffset(null);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    setPressed(false);
    if (!dragStart.current) return;
    dragStart.current = null;
    if (didDrag.current && livePos) {
      settleDrag(livePos);
    }
    // `didDrag` itself is consumed by the `onClick` suppression below, not
    // reset here — the click that follows this pointerup (or doesn't) is
    // still part of the same gesture.
  };

  const onPointerCancel = () => {
    setPressed(false);
    dragStart.current = null;
    setLivePos(null);
  };

  // A drag must not fire a click. `didDrag` is set the moment movement
  // crosses the threshold (in onPointerMove, before pointerup); the browser's
  // own click — which fires right after pointerup for a <button> — is
  // suppressed here rather than never letting pointerup call onClick
  // directly, so keyboard activation (Enter/Space, which synthesizes a click
  // with no preceding pointerdown) is completely unaffected.
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (didDrag.current) {
      e.preventDefault();
      e.stopPropagation();
      didDrag.current = false;
      return;
    }
    onClick();
  };

  // ── Style ──────────────────────────────────────────────────────────────
  const hasCustomPosition = storedPos !== null || livePos !== null;
  const activePos = livePos ?? storedPos;

  const positionStyle: React.CSSProperties = hasCustomPosition
    ? { left: activePos!.x, top: activePos!.y, right: 'auto', bottom: 'auto' }
    : // Untouched default: clear of the PDP sticky buy bar (z-30), with the
      // home-indicator safe area folded in — see ChatPanel.tsx for the panel
      // anchor this corner implies, and Footer.tsx for the same safe-area gap
      // on the other piece of fixed-positioned chrome this task audited.
      { right: 24, bottom: 'calc(84px + env(safe-area-inset-bottom))', left: 'auto', top: 'auto' };

  // Bug 2: a tucked (20%-hidden) button must come FULLY on screen before its
  // panel opens, and may return to its tucked resting spot on close. This is
  // purely a visual shift on top of `positionStyle` — `left`/`top` (and the
  // persisted store) are never touched, so closing the panel always restores
  // exactly the spot the button was dragged to. Skipped mid-drag (`livePos`
  // set): the button is already wherever the pointer put it, which is
  // already fully under the finger/cursor, so there is nothing to correct.
  const tuckedRestingEdge = !livePos && storedPos?.tucked ? storedPos.edge : null;
  const intoViewOffsetPx =
    open && tuckedRestingEdge
      ? tuckedRestingEdge === 'left'
        ? CHAT_BUTTON_TUCK_PX
        : -CHAT_BUTTON_TUCK_PX
      : 0;

  return (
    <button
      ref={buttonRef}
      data-testid="chat-button"
      aria-label="Open live support chat"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        position: 'fixed', zIndex: 200,
        ...positionStyle,
        width: CHAT_BUTTON_SIZE, height: CHAT_BUTTON_SIZE, borderRadius: '50%',
        background: hovered ? 'var(--mr-ink-700)' : 'var(--mr-ink-900)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(238,230,209,0.14)',
        boxShadow: hovered
          ? '0 8px 32px rgba(11,11,11,0.4), 0 0 0 8px rgba(11,11,11,0.08)'
          : '0 4px 20px rgba(11,11,11,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: dragStart.current ? 'grabbing' : 'grab',
        touchAction: 'none',
        transform: `${snapOffset ? `translate(${snapOffset.x}px, ${snapOffset.y}px) ` : ''}${intoViewOffsetPx !== 0 ? `translateX(${intoViewOffsetPx}px) ` : ''}${isMobile && open && !hasCustomPosition ? 'translateY(-6.5vh) ' : ''}${pressed ? 'scale(0.92)' : hovered ? 'scale(1.06)' : 'scale(1)'}`,
        // Motion rule: transform + opacity only, never `left`/`top` (those
        // now always jump instantly to their new value — see `settleDrag`'s
        // FLIP offset, which is what actually animates the snap-to-edge).
        transition: livePos || snapOffset
          ? 'none'
          : pressed
            ? 'transform var(--mr-dur-instant) var(--mr-ease-snappy)'
            : 'transform var(--mr-dur-normal) var(--mr-ease-out), background var(--mr-dur-fast), box-shadow var(--mr-dur-medium)',
        willChange: 'transform',
      }}
    >
      {/* The shop's own uploaded logo — the same slot the panel header uses
          (`MessageAvatar`), never the plain chat-bubble glyph this replaced.
          A gold circle behind it (matching the panel header's avatar chip)
          keeps a visible ring against the button's dark background whichever
          state renders: a photo, or the generic-icon fallback. */}
      <div
        style={{
          width: LAUNCHER_AVATAR_SIZE,
          height: LAUNCHER_AVATAR_SIZE,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'var(--mr-gold-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <MessageAvatar
          url={shopAvatarUrl}
          name={shopName}
          fallbackTestId="chat-launcher-avatar-generic"
        />
      </div>

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

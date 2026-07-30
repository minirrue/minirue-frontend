'use client';

import React from 'react';
import {
  CHAT_BUTTON_SIZE,
  CHAT_BUTTON_TUCK_PX,
  clampChatButtonPosition,
  hydrateChatButtonPosition,
  reclampChatButtonPosition,
  setChatButtonPosition,
  useChatButtonPosition,
  type ChatButtonEdge,
} from '@/lib/hooks/useChatButtonPosition';

interface ChatButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
  /** Whether the chat panel is open — on mobile the button lifts with the panel. */
  open?: boolean;
}

/** Past this many px of pointer travel, a gesture is a drag, not a tap. Small
 *  enough that a real drag is always caught; big enough that a trembling
 *  finger or a slightly-off mouse click still opens the chat. */
const DRAG_THRESHOLD_PX = 6;

/** Bug 3: within this many px of ANY of the four viewport edges, a released
 *  drag tucks 50% off-screen against the nearest left/right side — the same
 *  behavior this button always had. Farther than this from every edge, it
 *  stays fully visible exactly where it was released. Big enough that a
 *  release "near" a rail still reads as an intentional dock (matches a
 *  comfortable thumb drop-precision), small enough that most of a real phone
 *  or laptop screen counts as "the middle". */
const EDGE_PROXIMITY_PX = 80;

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export default function ChatButton({ onClick, hasUnread = false, open = false }: ChatButtonProps) {
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
    const center = finalPos.x + CHAT_BUTTON_SIZE / 2;
    const edge: ChatButtonEdge = center < vw / 2 ? 'left' : 'right';

    // Bug 3: tuck only when the release lands close to one of the four
    // edges; otherwise leave it fully visible right where it was dropped.
    const distLeft = finalPos.x;
    const distRight = vw - (finalPos.x + CHAT_BUTTON_SIZE);
    const distTop = finalPos.y;
    const distBottom = vh - (finalPos.y + CHAT_BUTTON_SIZE);
    const nearestEdgeDistance = Math.min(distLeft, distRight, distTop, distBottom);
    const tucked = nearestEdgeDistance <= EDGE_PROXIMITY_PX;

    const snapped = clampChatButtonPosition(
      { x: finalPos.x, y: finalPos.y, edge, tucked },
      vw,
      vh,
    );
    setChatButtonPosition(snapped);
    setLivePos(null);
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

  // Bug 2: a tucked (50%-hidden) button must come FULLY on screen before its
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
        transform: `${intoViewOffsetPx !== 0 ? `translateX(${intoViewOffsetPx}px) ` : ''}${isMobile && open && !hasCustomPosition ? 'translateY(-6.5vh) ' : ''}${pressed ? 'scale(0.92)' : hovered ? 'scale(1.06)' : 'scale(1)'}`,
        transition: livePos
          ? 'none'
          : pressed
            ? 'transform 80ms cubic-bezier(0.4,0,0.2,1)'
            : 'transform 260ms cubic-bezier(0.16,1,0.3,1), background 200ms, box-shadow 260ms, left 260ms cubic-bezier(0.16,1,0.3,1), top 260ms cubic-bezier(0.16,1,0.3,1)',
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

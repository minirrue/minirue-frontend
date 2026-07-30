'use client';

/**
 * useChatButtonPosition — the chat bubble's dragged-and-snapped position,
 * shared between `ChatButton` (the writer) and `ChatPanel` (the reader).
 *
 * `SupportWidget.tsx` renders `<ChatButton>` and `<ChatPanel>` as siblings
 * and is not a file this task owns, so a prop cannot be threaded from one to
 * the other through it. A tiny module-level store — the same shape as
 * `useMobileChrome` — lets both sides agree on where the button lives without
 * touching that file: `ChatButton` commits a settled (post-drag) position,
 * `ChatPanel` reads it to decide which corner to open from and to keep
 * itself fully on screen when the button is tucked at an edge.
 *
 * Persistence: localStorage, so the position survives a reload — the owner
 * wants the bubble to "stay put across visits", explicitly unlike the
 * announcement bar's collapsed state, which must reset. `null` means "no
 * custom position yet" — render the original fixed bottom/right corner
 * (with its `env(safe-area-inset-bottom)`) rather than a JS-computed
 * approximation of it.
 */

import React from 'react';

export type ChatButtonEdge = 'left' | 'right';

export interface ChatButtonPosition {
  /** Left edge of the button, in viewport px. May be negative (tucked). */
  x: number;
  /** Top edge of the button, in viewport px. */
  y: number;
  /** Nearest left/right side — drives which side ChatPanel opens from, and
   *  (when `tucked`) which edge the button docks against. */
  edge: ChatButtonEdge;
  /**
   * Whether the button is currently docked 50% off-screen against `edge`
   * (true) vs. fully on screen wherever it was released (false). Decided
   * once, when a drag settles, by proximity to the nearest viewport edge —
   * see `EDGE_PROXIMITY_PX` in ChatButton.tsx — and then preserved verbatim
   * by every re-clamp after that (resize, hydrate from storage) so a
   * fully-visible button re-homes back to fully visible, not into a corner
   * it was never dragged near.
   */
  tucked: boolean;
}

export const CHAT_BUTTON_SIZE = 52;
/** How far past the edge the button tucks — half its own width. */
const TUCK_FRACTION = 0.5;
/** In px: exactly how far a tucked button sits off screen, and therefore how
 *  far a tap must shift it to bring it fully into view (ChatButton.tsx,
 *  Bug 2). Exported so that file doesn't hardcode a second copy of the same
 *  number. */
export const CHAT_BUTTON_TUCK_PX = CHAT_BUTTON_SIZE * TUCK_FRACTION;
const STORAGE_KEY = 'mr:chat-button-pos';

let current: ChatButtonPosition | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ChatButtonPosition | null {
  return current;
}

function getServerSnapshot(): ChatButtonPosition | null {
  return null;
}

/** Clamp a settled position to whatever the viewport is right now — used both
 *  right after a drag and to re-home a position read back from a previous,
 *  possibly narrower/shorter, viewport.
 *
 *  Branches on `pos.tucked` (Bug 3): a tucked position is re-homed to the
 *  half-off-screen spot against its edge, exactly as before this field
 *  existed; a non-tucked position is simply clamped to stay fully inside the
 *  current viewport, wherever it was released. */
export function clampChatButtonPosition(
  pos: ChatButtonPosition,
  viewportW: number,
  viewportH: number,
  size = CHAT_BUTTON_SIZE,
): ChatButtonPosition {
  const minY = 8;
  const maxY = Math.max(minY, viewportH - size - 8);
  const y = Math.min(Math.max(pos.y, minY), maxY);

  if (pos.tucked) {
    const tuck = size * TUCK_FRACTION;
    const x = pos.edge === 'left' ? -tuck : viewportW - size + tuck;
    return { x, y, edge: pos.edge, tucked: true };
  }

  const minX = 0;
  const maxX = Math.max(minX, viewportW - size);
  const x = Math.min(Math.max(pos.x, minX), maxX);
  return { x, y, edge: pos.edge, tucked: false };
}

function readStored(): ChatButtonPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatButtonPosition>;
    if (
      typeof parsed.y !== 'number' ||
      (parsed.edge !== 'left' && parsed.edge !== 'right')
    ) {
      return null;
    }
    return clampChatButtonPosition(
      // `tucked` defaults to `true` for a position stored before that field
      // existed — preserves the old (always-tucked) behavior for anyone who
      // already had a saved spot, rather than surprising them with a jump to
      // fully-visible on their next visit.
      { x: parsed.x ?? 0, y: parsed.y, edge: parsed.edge, tucked: parsed.tucked ?? true },
      window.innerWidth,
      window.innerHeight,
    );
  } catch {
    return null;
  }
}

/** Read the stored position (clamped to the current viewport) once, on the
 *  client. Idempotent — later calls after the first are no-ops. */
export function hydrateChatButtonPosition(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const stored = readStored();
  if (stored) {
    current = stored;
    emit();
  }
}

/** Commit a settled (post-drag, already-snapped) position and persist it. */
export function setChatButtonPosition(pos: ChatButtonPosition): void {
  current = pos;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // Storage full/blocked — position still works for this session.
    }
  }
  emit();
}

/** Re-clamp the current custom position to the live viewport — call on
 *  resize/orientation change so a stored position can never end up
 *  unreachable. No-ops when the button is still at its untouched default. */
export function reclampChatButtonPosition(viewportW: number, viewportH: number): void {
  if (!current) return;
  current = clampChatButtonPosition(current, viewportW, viewportH);
  emit();
}

/** Reset for tests — production code never needs this. */
export function __resetChatButtonPositionForTests(): void {
  current = null;
  hydrated = false;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function useChatButtonPosition(): ChatButtonPosition | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

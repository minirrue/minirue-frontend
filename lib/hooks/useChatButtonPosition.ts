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
   * Whether the button is currently docked against `edge` — 20% off-screen,
   * so 80% of it still shows — versus fully on screen wherever it was
   * released. Decided once, when a drag settles, by whether the release
   * landed inside `chatButtonEdgeBandPx` of the LEFT or RIGHT side, then
   * preserved verbatim by every re-clamp after that (resize, hydrate from
   * storage) so a fully-visible button re-homes back to fully visible, not
   * into a corner it was never dragged near.
   */
  tucked: boolean;
}

export const CHAT_BUTTON_SIZE = 52;
/** The fraction of the button that goes PAST the edge when docked — so it
 *  stays 80% visible. It was half, which hid enough of the icon that the
 *  docked button read as broken rather than parked. */
const TUCK_FRACTION = 0.2;

/**
 * The band running down the LEFT and RIGHT sides of the viewport, as a
 * fraction of its width. It does two jobs, and they are the same number on
 * purpose:
 *
 *   - Release the button INSIDE the band and it docks against that side, 20%
 *     off-screen — 80% of it still shows.
 *   - Release it OUTSIDE the band and it stays whole — resting no nearer the
 *     side than the band's inner edge, so a fully-visible button always has
 *     this much air beside it.
 *
 * Only the left and right sides count. Height is irrelevant: a bubble dropped
 * low in the middle of the screen is not "at an edge", and treating it as one
 * is why the button used to half-hide itself almost anywhere on a phone.
 */
export const CHAT_BUTTON_EDGE_BAND_VW = 0.04;

/** The band in px for a given viewport width. Floored so the gutter never
 *  collapses to nothing on a very narrow screen. */
export function chatButtonEdgeBandPx(viewportW: number): number {
  return Math.max(8, Math.round(viewportW * CHAT_BUTTON_EDGE_BAND_VW));
}
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
 *  existed.
 *
 *  A non-tucked position now ALWAYS rests flush (with the same band as a
 *  gutter) against `pos.edge` — never "wherever it was released". Dropped in
 *  the middle of the screen used to leave the button exactly there, floating
 *  and fixed; the owner asked for the opposite: drag it anywhere, and on
 *  release it always settles against the nearer side. Vertical position is
 *  untouched either way — only left/right ever decide an edge. */
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

  // Fully visible means fully visible WITH air beside it: the same band that
  // decides whether to tuck is also the closest a whole button may rest to a
  // side. `pos.edge` (decided by the caller from the button's CENTRE against
  // the viewport midpoint — see ChatButton.tsx's `settleDrag`) wins outright
  // rather than merely bounding `pos.x`, so every release ends up AT one of
  // these two values, never in between.
  const band = chatButtonEdgeBandPx(viewportW);
  const minX = band;
  const maxX = Math.max(minX, viewportW - size - band);
  const x = pos.edge === 'left' ? minX : maxX;
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

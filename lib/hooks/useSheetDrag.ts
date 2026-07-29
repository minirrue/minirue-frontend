'use client';

/**
 * useSheetDrag — drag a sheet by its handle to dismiss it.
 *
 * A sheet that animates from an edge but cannot be pushed back to that edge
 * feels like a modal wearing a sheet's clothes. The grabber pill is a promise;
 * this keeps it.
 *
 * Direction is the direction that DISMISSES: 'down' for a sheet that rose from
 * the bottom, 'up' for one that dropped from the top. `offset` is always
 * reported as positive-toward-dismissal, so callers apply it as
 * `translateY(offset)` or `translateY(-offset)` and never reason about signs.
 *
 * Two ways to let go and have it close, because one is not enough: a slow drag
 * past a distance threshold, or a quick flick regardless of distance. Velocity
 * is measured from the last two pointer samples, not the whole gesture — a
 * gesture that hesitates then flicks is a flick, and averaging over its whole
 * duration would score it as a crawl.
 */

import React from 'react';

interface SheetDragOptions {
  /** The direction that dismisses the sheet. */
  direction: 'down' | 'up';
  /** Only draggable while genuinely open. */
  enabled: boolean;
  onDismiss: () => void;
  /** The sheet itself, measured to turn px into a 0-1 progress for the backdrop. */
  sheetRef: React.RefObject<HTMLElement | null>;
  /** Past this many px, releasing dismisses. */
  distanceThreshold?: number;
  /** px per ms; past this, releasing dismisses regardless of distance. */
  velocityThreshold?: number;
}

interface SheetDragResult {
  /** Px moved toward dismissal. Negative means dragged the wrong way (damped). */
  offset: number;
  dragging: boolean;
  /** 0-1 fraction of the sheet's own size dragged away — for fading a backdrop. */
  progress: number;
  /** Spread onto the drag handle element. */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
}

/** Dragging away from the edge should feel resisted, not free. */
const OVERDRAG_DAMPING = 0.25;

export function useSheetDrag({
  direction,
  enabled,
  onDismiss,
  sheetRef,
  distanceThreshold = 96,
  velocityThreshold = 0.45,
}: SheetDragOptions): SheetDragResult {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  // Progress is state, not derived at render time from the measured height:
  // the measurement lives in a ref (it is only ever taken inside an event
  // handler) and reading a ref during render is not allowed.
  const [progress, setProgress] = React.useState(0);

  const startY = React.useRef(0);
  const sheetSize = React.useRef(0);
  const lastSample = React.useRef<{ y: number; t: number } | null>(null);
  const prevSample = React.useRef<{ y: number; t: number } | null>(null);

  // Closing must reset the drag, or reopening starts mid-gesture. Adjusted
  // during render rather than in an effect so the sheet never paints one frame
  // at its old dragged position.
  const [wasEnabled, setWasEnabled] = React.useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (offset !== 0) setOffset(0);
    if (progress !== 0) setProgress(0);
    if (dragging) setDragging(false);
  }

  /** Signed distance toward dismissal for a given pointer position. */
  const travel = (clientY: number): number =>
    direction === 'down' ? clientY - startY.current : startY.current - clientY;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled || !e.isPrimary) return;
    // A handle usually contains controls — a close button, a back button, the
    // search input. Capturing the pointer for those would redirect the click to
    // the handle and the control would simply never fire. Pressing a control is
    // not the start of a drag.
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    startY.current = e.clientY;
    sheetSize.current = sheetRef.current?.offsetHeight ?? 0;
    lastSample.current = { y: e.clientY, t: e.timeStamp };
    prevSample.current = null;
    setDragging(true);
    // Capture so the gesture survives the pointer leaving the handle — which it
    // will, since dragging the sheet moves the handle out from under the finger.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    prevSample.current = lastSample.current;
    lastSample.current = { y: e.clientY, t: e.timeStamp };
    const raw = travel(e.clientY);
    const next = raw >= 0 ? raw : raw * OVERDRAG_DAMPING;
    setOffset(next);
    setProgress(
      sheetSize.current > 0 ? Math.min(Math.max(next / sheetSize.current, 0), 1) : 0,
    );
  };

  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    if (!dragging) return;
    setDragging(false);
    setOffset(0);
    setProgress(0);

    if (cancelled) return;

    const raw = travel(e.clientY);
    const prev = prevSample.current;
    const velocity =
      prev && e.timeStamp > prev.t
        ? (direction === 'down' ? e.clientY - prev.y : prev.y - e.clientY) /
          (e.timeStamp - prev.t)
        : 0;

    if (raw > distanceThreshold || velocity > velocityThreshold) onDismiss();
  };

  return {
    offset,
    dragging,
    progress,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e) => finish(e, false),
      onPointerCancel: (e) => finish(e, true),
      style: {
        // The handle owns vertical gestures; without this the browser starts
        // scrolling the page and the drag never gets its move events.
        touchAction: 'none',
        cursor: enabled ? 'grab' : undefined,
      },
    },
  };
}

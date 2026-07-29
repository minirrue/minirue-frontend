import type React from 'react';

/**
 * The house bottom-sheet motion, in one place.
 *
 * Two curves doing two different jobs, which is what makes the move read as
 * physical rather than as a fade:
 *
 *   The sheet is heavy. `cubic-bezier(0.7, 0, 0.2, 1)` over 600ms — a long slow
 *   start, then it snaps home. translateY(100%) -> 0.
 *
 *   The contents are light. Transform on `cubic-bezier(0.075, 0.82, 0.165, 1)`
 *   (fast off the mark, long tail) and opacity on `cubic-bezier(0.19, 1, 0.22, 1)`,
 *   both 600ms, from 20px below. Splitting the two curves is what gives the
 *   soft landing; running both on one curve looks mechanical.
 *
 *   Nothing inside moves until the sheet is roughly half-open: 300ms base delay,
 *   then 100ms more per item.
 *
 * `prefers-reduced-motion` needs no branch here — mr-tokens.css collapses every
 * transition to 0.01ms globally, and none of this gates whether content is
 * visible, only when it arrives.
 *
 * MobileNavSheet and SearchSheet shipped this first and still own their own
 * markup; they import these constants so there is exactly one definition of the
 * timing rather than three copies drifting apart.
 */

export const SHEET_DURATION_MS = 600;

/** Heavy: long anticipation, then it snaps into place. */
export const SHEET_EASE = 'cubic-bezier(0.7,0,0.2,1)';

export const SHEET_TRANSITION = `transform ${SHEET_DURATION_MS}ms ${SHEET_EASE}`;

/** Light: two curves, so the landing is soft rather than mechanical. */
export const ITEM_TRANSITION =
  'transform 600ms cubic-bezier(0.075,0.82,0.165,1), opacity 600ms cubic-bezier(0.19,1,0.22,1)';

/** How far a child starts below its resting position. */
export const ITEM_OFFSET_PX = 20;

/** Base delay before anything inside starts moving. */
export const ITEM_BASE_DELAY_MS = 300;
export const ITEM_STEP_MS = 100;

/**
 * The reference spec adds 100ms per item without limit. Uncapped, a ten-item
 * list takes 1.3s to finish arriving, and past about a second choreography
 * reads as lag. Capped at 900ms.
 */
export const ITEM_MAX_DELAY_MS = 900;

export function itemDelay(index: number): string {
  return `${Math.min(ITEM_BASE_DELAY_MS + index * ITEM_STEP_MS, ITEM_MAX_DELAY_MS)}ms`;
}

/** Everything a staggered child of an open/closed sheet needs. */
export function itemStyle(index: number, open: boolean): React.CSSProperties {
  return {
    opacity: open ? 1 : 0,
    transform: open ? 'translateY(0)' : `translateY(${ITEM_OFFSET_PX}px)`,
    transition: ITEM_TRANSITION,
    transitionDelay: open ? itemDelay(index) : '0ms',
    willChange: 'transform, opacity',
  };
}

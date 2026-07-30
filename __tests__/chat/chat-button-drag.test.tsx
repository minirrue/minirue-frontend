import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ChatButton from '@/components/chat/ChatButton';
import {
  CHAT_BUTTON_SIZE,
  CHAT_BUTTON_TUCK_PX,
  __resetChatButtonPositionForTests,
} from '@/lib/hooks/useChatButtonPosition';

/**
 * W4a.3 — the draggable chat bubble. Per the brief, correctness of the
 * tap-vs-drag distinction matters more than the polish of the snap
 * animation: a drag that fires a click and opens the chat every time the
 * user moves it would be worse than not shipping the feature at all, so
 * that gets the most direct coverage here.
 */

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function button(): HTMLElement {
  return screen.getByTestId('chat-button');
}

// This project's jest/jsdom environment has no global `PointerEvent`
// constructor at all (confirmed: `new PointerEvent(...)` throws
// `ReferenceError: PointerEvent is not defined`), and `@testing-library`'s
// `fireEvent.pointerDown` degrades silently rather than throwing — it
// dispatches SOMETHING, but `clientX`/`clientY`/`isPrimary`/`pointerId` all
// come through as `undefined`, which fails ChatButton's `!e.isPrimary`
// guard before the gesture ever starts. Firing a plain `MouseEvent` and
// grafting the pointer-only fields onto it is a real substitute for the
// purposes of this test: React reads `clientX`/`isPrimary`/`pointerId` off
// the native event via plain property access, not an `instanceof
// PointerEvent` check, so it can't tell the difference.
function firePointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 1, configurable: true });
  Object.defineProperty(event, 'isPrimary', { value: true, configurable: true });
  act(() => {
    button().dispatchEvent(event);
  });
}

function pointerDown(x: number, y: number) {
  firePointer('pointerdown', x, y);
}
function pointerMove(x: number, y: number) {
  firePointer('pointermove', x, y);
}
function pointerUp(x: number, y: number) {
  firePointer('pointerup', x, y);
}
/** A real browser fires `click` right after `pointerup` for a `<button>`,
 *  drag or not — ChatButton.tsx relies on that and suppresses it itself when
 *  a drag occurred, so tests reproduce the same sequence rather than relying
 *  on jsdom to synthesize it. */
function click() {
  fireEvent.click(button());
}

beforeEach(() => {
  setViewport(1000, 800);
  window.localStorage.clear();
  __resetChatButtonPositionForTests();
});

describe('ChatButton drag vs tap (W4a.3)', () => {
  it('a tap under the movement threshold opens the chat', () => {
    const onClick = jest.fn();
    render(<ChatButton onClick={onClick} />);

    pointerDown(500, 500);
    pointerMove(502, 501); // 2px — under the 6px threshold
    pointerUp(502, 501);
    click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a drag over the threshold does not open the chat', () => {
    const onClick = jest.fn();
    render(<ChatButton onClick={onClick} />);

    pointerDown(500, 500);
    pointerMove(560, 500); // 60px — well over the threshold
    pointerUp(560, 500);
    click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it('a plain click with no preceding pointer gesture still opens the chat (keyboard activation)', () => {
    const onClick = jest.fn();
    render(<ChatButton onClick={onClick} />);

    // Enter/Space on a focused <button> synthesizes a `click` with no
    // pointerdown/pointerup at all — the suppression must not eat this.
    click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ChatButton snap-to-edge and persistence (W4a.3)', () => {
  // jsdom has no layout engine — `getBoundingClientRect()` always reports
  // {0,0,0,0} regardless of the button's real CSS `right`/`bottom` position,
  // so ChatButton.tsx's drag origin is always (0,0) here. The edge the
  // button snaps to depends only on the drag DISTANCE from that origin
  // (whether the released center clears the viewport midline), not on
  // where the pointer visually started — these deltas are chosen to land
  // past the midline in each direction on that basis.

  it('released past the midline, the button snaps to the right edge, tucked half off-screen', () => {
    render(<ChatButton onClick={jest.fn()} />);

    pointerDown(0, 400);
    pointerMove(800, 400); // drag distance alone carries the center past the 1000/2 midline
    pointerUp(800, 400);
    click(); // suppressed — proves this really was read as a drag

    const el = button();
    // Tucked: left edge sits at viewportWidth - size/2, i.e. only half the
    // button remains on screen.
    const expectedLeft = 1000 - CHAT_BUTTON_SIZE / 2;
    expect(el.style.left).toBe(`${expectedLeft}px`);
  });

  it('released before the midline, it snaps to the left edge, tucked half off-screen', () => {
    render(<ChatButton onClick={jest.fn()} />);

    pointerDown(0, 400);
    pointerMove(30, 400); // small drag distance — the center stays left of midline
    pointerUp(30, 400);

    const el = button();
    const expectedLeft = -(CHAT_BUTTON_SIZE / 2);
    expect(el.style.left).toBe(`${expectedLeft}px`);
  });

  it('position survives a remount (read back from storage)', () => {
    const { unmount } = render(<ChatButton onClick={jest.fn()} />);
    pointerDown(900, 300);
    pointerMove(950, 300);
    pointerUp(950, 300);
    const settledLeft = button().style.left;
    const settledTop = button().style.top;
    unmount();

    render(<ChatButton onClick={jest.fn()} />);
    expect(button().style.left).toBe(settledLeft);
    expect(button().style.top).toBe(settledTop);
  });

  it('a stored position outside the current viewport is clamped back inside on mount', () => {
    // Simulate a position saved on a much taller/wider screen.
    window.localStorage.setItem(
      'mr:chat-button-pos',
      JSON.stringify({ x: 1900, y: 3000, edge: 'right' }),
    );

    render(<ChatButton onClick={jest.fn()} />);

    const el = button();
    const top = parseFloat(el.style.top);
    expect(top).toBeLessThanOrEqual(800 - CHAT_BUTTON_SIZE - 8);
    expect(top).toBeGreaterThanOrEqual(8);
    // Still tucked at its stored edge, but re-homed to the CURRENT viewport
    // width (1000), not the stale 1900 it was saved with.
    expect(el.style.left).toBe(`${1000 - CHAT_BUTTON_SIZE / 2}px`);
  });

  it('re-clamps on resize so a custom position can never end up unreachable', () => {
    render(<ChatButton onClick={jest.fn()} />);
    pointerDown(900, 700); // near the bottom-right of an 800px-tall viewport
    pointerMove(950, 750);
    pointerUp(950, 750);

    setViewport(1000, 400); // viewport shrinks a lot (e.g. orientation change)
    fireEvent(window, new Event('resize'));

    const top = parseFloat(button().style.top);
    expect(top).toBeLessThanOrEqual(400 - CHAT_BUTTON_SIZE - 8);
  });

  it('a stored NON-tucked position outside a smaller current viewport clamps back onto screen', () => {
    // Saved on a much bigger screen, and explicitly fully-visible (not
    // tucked) — the new clamp branch (Bug 3) must still pull it fully
    // inside the current 1000x800 viewport, not just re-home it as tucked.
    window.localStorage.setItem(
      'mr:chat-button-pos',
      JSON.stringify({ x: 5000, y: 3000, edge: 'right', tucked: false }),
    );

    render(<ChatButton onClick={jest.fn()} />);

    const el = button();
    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(1000 - CHAT_BUTTON_SIZE);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top).toBeLessThanOrEqual(800 - CHAT_BUTTON_SIZE - 8);
  });
});

describe('ChatButton edge-proximity visibility (Bug 3)', () => {
  it('released far from all four edges, the button stays 100% visible exactly where dropped', () => {
    render(<ChatButton onClick={jest.fn()} />);

    // jsdom reports the drag origin as (0,0) (see note above), so the drag
    // distance alone determines the settled point: (500, 400) in a
    // 1000x800 viewport puts every edge distance comfortably past
    // EDGE_PROXIMITY_PX (80px).
    pointerDown(0, 0);
    pointerMove(500, 400);
    pointerUp(500, 400);

    const el = button();
    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);
    expect(left).toBe(500);
    expect(top).toBe(400);
    // Fully visible: no part of the button crosses any of the four edges.
    expect(left).toBeGreaterThan(80);
    expect(1000 - (left + CHAT_BUTTON_SIZE)).toBeGreaterThan(80);
    expect(top).toBeGreaterThan(80);
    expect(800 - (top + CHAT_BUTTON_SIZE)).toBeGreaterThan(80);
  });

  it('released near the TOP edge (even horizontally centered), it still tucks 50% against the nearest side', () => {
    render(<ChatButton onClick={jest.fn()} />);

    // x lands left-of-center (so it docks left) while y lands just 20px
    // from the top — proximity to ANY of the four edges triggers the tuck,
    // not just the left/right ones.
    pointerDown(0, 0);
    pointerMove(400, 20);
    pointerUp(400, 20);

    const el = button();
    expect(el.style.left).toBe(`${-(CHAT_BUTTON_SIZE / 2)}px`);
  });
});

describe('ChatButton comes fully into view on open (Bug 2)', () => {
  it('tapping a tucked bubble shifts it fully on screen via transform, and it returns to tucked on close', () => {
    const { rerender } = render(<ChatButton onClick={jest.fn()} open={false} />);

    // Drag past the midline and near the right edge so it settles tucked.
    pointerDown(0, 400);
    pointerMove(800, 400);
    pointerUp(800, 400);

    const el = button();
    const tuckedLeft = parseFloat(el.style.left);
    expect(tuckedLeft).toBe(1000 - CHAT_BUTTON_SIZE / 2);
    // Still tucked while closed — no into-view shift applied.
    expect(el.style.transform).not.toContain('translateX');

    rerender(<ChatButton onClick={jest.fn()} open />);

    // The stored/rendered left never moves — only a visual transform shifts it.
    expect(parseFloat(el.style.left)).toBe(tuckedLeft);
    expect(el.style.transform).toContain(`translateX(-${CHAT_BUTTON_TUCK_PX}px)`);
    // With the transform applied, the button is entirely within the viewport.
    expect(tuckedLeft - CHAT_BUTTON_TUCK_PX).toBeGreaterThanOrEqual(0);
    expect(tuckedLeft - CHAT_BUTTON_TUCK_PX + CHAT_BUTTON_SIZE).toBeLessThanOrEqual(1000);

    // Closing returns it to its tucked resting spot (position untouched throughout).
    rerender(<ChatButton onClick={jest.fn()} open={false} />);
    expect(el.style.transform).not.toContain('translateX');
    expect(parseFloat(el.style.left)).toBe(tuckedLeft);
  });

  it('tapping a bubble tucked at the LEFT edge shifts it fully into view in the opposite direction', () => {
    const { rerender } = render(<ChatButton onClick={jest.fn()} open={false} />);

    pointerDown(0, 400);
    pointerMove(30, 400); // stays left of midline — docks left, tucked
    pointerUp(30, 400);

    const el = button();
    const tuckedLeft = parseFloat(el.style.left);
    expect(tuckedLeft).toBe(-(CHAT_BUTTON_SIZE / 2));

    rerender(<ChatButton onClick={jest.fn()} open />);

    expect(el.style.transform).toContain(`translateX(${CHAT_BUTTON_TUCK_PX}px)`);
    expect(tuckedLeft + CHAT_BUTTON_TUCK_PX).toBeGreaterThanOrEqual(0);
  });

  it('a fully-visible (non-tucked) bubble gets no into-view shift when opened', () => {
    const { rerender } = render(<ChatButton onClick={jest.fn()} open={false} />);

    pointerDown(0, 0);
    pointerMove(500, 400); // far from every edge — settles non-tucked
    pointerUp(500, 400);

    const el = button();
    const left = parseFloat(el.style.left);

    rerender(<ChatButton onClick={jest.fn()} open />);

    expect(el.style.transform).not.toContain('translateX');
    expect(parseFloat(el.style.left)).toBe(left);
  });
});

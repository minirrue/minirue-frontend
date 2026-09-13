/**
 * @jest-environment jsdom
 */
import { isOwnScroller } from '@/lib/scroll/is-own-scroller';

/**
 * Nested scrollers keep native wheel scrolling under Lenis (frontend#87).
 *
 * Lenis cancels the wheel for the window, so a box with its own overflow — the
 * product info column, the side cart — only moved when its scrollbar was
 * dragged. Verified in real Chrome: the product column went from 0px to its full
 * 86px of overflow under real wheel events after this rule, and the page still
 * smooth-scrolled.
 */

function box({ overflowY, scrollHeight, clientHeight, attr = false }: {
  overflowY: string;
  scrollHeight: number;
  clientHeight: number;
  attr?: boolean;
}): HTMLElement {
  const el = document.createElement('div');
  el.style.overflowY = overflowY;
  if (attr) el.setAttribute('data-lenis-prevent', '');
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight });
  document.body.appendChild(el);
  return el;
}

describe('isOwnScroller', () => {
  it('lets a box that can scroll on its own scroll natively', () => {
    expect(isOwnScroller(box({ overflowY: 'auto', scrollHeight: 786, clientHeight: 700 }))).toBe(true);
    expect(isOwnScroller(box({ overflowY: 'scroll', scrollHeight: 786, clientHeight: 700 }))).toBe(true);
  });

  it('leaves Lenis in charge of a box whose content fits', () => {
    // The product column on a phone has overflow-y:auto only from lg:, and a
    // tall window fits it entirely — nothing to scroll, so the page scrolls.
    expect(isOwnScroller(box({ overflowY: 'auto', scrollHeight: 500, clientHeight: 700 }))).toBe(false);
  });

  it('leaves Lenis in charge of a box that does not scroll', () => {
    expect(isOwnScroller(box({ overflowY: 'visible', scrollHeight: 2000, clientHeight: 700 }))).toBe(false);
    expect(isOwnScroller(box({ overflowY: 'hidden', scrollHeight: 2000, clientHeight: 700 }))).toBe(false);
  });

  it('honours an explicit data-lenis-prevent', () => {
    expect(isOwnScroller(box({ overflowY: 'visible', scrollHeight: 0, clientHeight: 0, attr: true }))).toBe(true);
  });

  it('never exempts the page itself', () => {
    expect(isOwnScroller(document.documentElement)).toBe(false);
    expect(isOwnScroller(document.body)).toBe(false);
  });
});

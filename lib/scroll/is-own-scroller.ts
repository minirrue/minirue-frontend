/**
 * Let a nested scroller keep its own wheel and touch scrolling (frontend#87).
 *
 * Lenis drives the WINDOW scroll and cancels the native wheel event, so any box
 * with its own `overflow-y: auto` — the product info column on shorter windows,
 * the side cart, sheets, search results — moved only when its scrollbar was
 * dragged. The chat panel worked because it alone carried `data-lenis-prevent`.
 *
 * Lenis calls this for each element between the event target and the root; any
 * element that can actually scroll vertically on its own opts the event out of
 * smoothing, so the browser scrolls that element natively. The check is live
 * (computed style + real sizes), so the lg:-only column scrolls natively on a
 * laptop and is ignored on a phone, where it does not scroll. New scrollers are
 * covered without anyone remembering an attribute.
 */
export function isOwnScroller(node: HTMLElement): boolean {
  if (node.hasAttribute('data-lenis-prevent')) return true;
  if (node === document.documentElement || node === document.body) return false;
  const overflowY = window.getComputedStyle(node).overflowY;
  return (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight;
}

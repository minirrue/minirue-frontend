/**
 * Removes focus from whatever element currently holds it.
 *
 * `router.push()` is a client-side transition — the page swaps its content
 * without a full document reload, so a focused <input> (the last field the
 * shopper typed into, e.g. confirm-password) can be unmounted mid-focus
 * without a real `blur` ever firing on it. Desktop browsers quietly move
 * focus to `<body>` when that happens; mobile Safari/Chrome do not reliably
 * close the on-screen keyboard for it, so the keyboard stays open on
 * whatever page follows — which usually has no input on it at all to
 * explain why.
 *
 * Call this right before `router.push()` in any auth flow that redirects
 * after a successful form submission (signup, login, reset-password).
 */
export function blurActiveElement(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

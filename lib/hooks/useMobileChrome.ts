'use client';

/**
 * useMobileChrome — the shared open/closed state for the mobile nav sheet and
 * the search sheet.
 *
 * `Header.tsx` owns the hamburger button AND is the only place that renders
 * `<MobileNavSheet>`/`<SearchSheet>` (it already has the `navbar`/`socials`/
 * `signedIn` data those need). `MobileBottomNav` is mounted once, globally,
 * in `app/layout.tsx` — a different React subtree that is never a parent or
 * child of whichever `Header` instance the current route happens to render.
 * Neither can reach into the other's local `useState`, and `MobileNavSheet`/
 * `SupportWidget`-style prop wiring is not an option: `MobileNavSheet.tsx`
 * belongs to another agent this round, and `Header` is rendered fresh by
 * several different page shells (HomePageClient, HeaderWrapper, CheckoutShell,
 * AccountLayoutClient), so there is no single call site to thread a prop
 * through.
 *
 * A module-level external store is the plain fix: both sides import the same
 * two functions and the same `useSyncExternalStore` hook. `Header` reads it
 * to decide whether to render `MobileNavSheet`/`SearchSheet` open; the bottom
 * nav's Menu/Search buttons call the setters. "Opens the same MobileNavSheet
 * the hamburger opens" is then literal — it's the same sheet instance Header
 * already renders, not a second copy.
 */

import React from 'react';

interface MobileChromeState {
  menuOpen: boolean;
  searchOpen: boolean;
}

let state: MobileChromeState = { menuOpen: false, searchOpen: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): MobileChromeState {
  return state;
}

function getServerSnapshot(): MobileChromeState {
  return { menuOpen: false, searchOpen: false };
}

export function openMobileMenu(): void {
  state = { ...state, menuOpen: true };
  emit();
}

export function closeMobileMenu(): void {
  state = { ...state, menuOpen: false };
  emit();
}

export function openMobileSearch(): void {
  state = { ...state, searchOpen: true };
  emit();
}

export function closeMobileSearch(): void {
  state = { ...state, searchOpen: false };
  emit();
}

/** Reset for tests — production code never needs this. */
export function __resetMobileChromeForTests(): void {
  state = { menuOpen: false, searchOpen: false };
}

export function useMobileChrome(): MobileChromeState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

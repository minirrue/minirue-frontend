'use client';

const KEY = 'mr-support-guest';

export interface GuestSupport {
  conversationId: string;
  guestToken: string;
}

export function getGuestSupport(): GuestSupport | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestSupport;
  } catch {
    return null;
  }
}

export function setGuestSupport(v: GuestSupport): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(v));
}

export function clearGuestSupport(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

'use client';

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: string;
  createdAt: number;
}

const KEY = 'mr-session';

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session & { firstName?: string };
    if (!parsed.name && parsed.firstName) {
      return { ...parsed, name: parsed.firstName };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(s: Session): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

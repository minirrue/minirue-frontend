import { API_BASE } from './base';

/**
 * The daily giveaway pages (minirue-frontend#205, backend#260). Everything
 * here is the PUBLIC payload (minirue-backend@0.140.0): the entrant's full
 * name and the last two phone digits, never a full phone, email or anything
 * anyone spent. The prize is absent until the reveal.
 */
export type GiveawayPool = 'BOOTH' | 'ONLINE';
export type GiveawaySlug = 'booth' | 'online';

export type GiveawayState =
  | 'OFF'
  | 'OPEN'
  | 'DRAWN'
  | 'PENDING_DRAW'
  | 'NO_ENTRIES'
  | 'REVEALED';

export interface GiveawayEntrant {
  ref: number;
  /** "First Last"; null when they asked not to be listed. */
  name: string | null;
  phoneTail: string | null;
  qualifiedAt: string;
}

export interface GiveawayWinner {
  ref: number;
  name: string | null;
  phoneTail: string | null;
}

export interface GiveawayPrize {
  title: string;
  description: string;
  imageUrl: string | null;
  mediaKind: 'image' | 'video';
}

export interface GiveawaySnapshot {
  pool: GiveawayPool;
  state: GiveawayState;
  day: string;
  timezone: string;
  serverTime: string;
  /**
   * How many are in the draw (0 when OFF). Optional only for payloads from
   * before minirue-backend@0.140.0; fall back to `entrants.length`.
   */
  entrantCount?: number;
  title?: string;
  /** Only present once `state === 'REVEALED'`. */
  prize?: GiveawayPrize;
  terms?: string;
  minSpendMinor?: number;
  countsShipping?: boolean;
  revealAt?: string;
  entriesClosed?: boolean;
  /** Latest to qualify first; `ref` is the stable qualifying number. */
  entrants?: GiveawayEntrant[];
  winner?: GiveawayWinner | null;
}

export interface GiveawayIndex {
  serverTime: string;
  pools: {
    pool: GiveawayPool;
    state: GiveawayState;
    title?: string;
    revealAt?: string;
    day: string;
    entrantCount: number;
  }[];
}

export const GIVEAWAY_SLUGS: Record<GiveawaySlug, GiveawayPool> = {
  booth: 'BOOTH',
  online: 'ONLINE',
};

export function slugOfPool(pool: GiveawayPool): GiveawaySlug {
  return pool === 'BOOTH' ? 'booth' : 'online';
}

/** Server or browser; never cached — the payload changes around the reveal. */
export async function fetchGiveaway(
  slug: GiveawaySlug,
): Promise<GiveawaySnapshot | null> {
  const res = await fetch(`${API_BASE}/giveaway/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as GiveawaySnapshot;
}

export async function fetchGiveawayIndex(): Promise<GiveawayIndex | null> {
  const res = await fetch(`${API_BASE}/giveaway`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as GiveawayIndex;
}

/** The SSE stream URL for one pool (browser only: same-origin /v1 proxy). */
export function giveawayEventsUrl(slug: GiveawaySlug): string {
  return `${API_BASE}/giveaway/${slug}/events`;
}

const CAIRO = 'Africa/Cairo';

/** "10:00 PM" — every time on these pages is 12-hour, Cairo time. */
export function formatCairoTime(iso: string, timeZone = CAIRO): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "Thursday, 1 October 2026" for a YYYY-MM-DD day. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "1,000 EGP" from piastres. */
export function formatEgp(minor: number): string {
  const egp = minor / 100;
  return `${egp.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(egp) ? 0 : 2,
    maximumFractionDigits: 2,
  })} EGP`;
}

/** "02:14:33" until `targetMs`, or null once it has passed. */
export function formatCountdown(msLeft: number): string | null {
  if (msLeft <= 0) return null;
  const s = Math.floor(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

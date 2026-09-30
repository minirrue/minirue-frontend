'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchGiveaway,
  giveawayEventsUrl,
  type GiveawaySlug,
  type GiveawaySnapshot,
} from '@/lib/api/giveaway';

export type GiveawayTransport = 'connecting' | 'live' | 'polling';

const POLL_MS = 15_000;
/** How long after the reveal time a page that heard nothing asks for itself. */
const REVEAL_GRACE_MS = 1_500;

/**
 * Keeps one giveaway snapshot live (minirue-frontend#205).
 *
 * The backend pushes the whole masked snapshot over SSE on every change —
 * a new entrant, an admin edit, the draw, and the reveal itself — so every
 * open page flips at the same moment. If the stream cannot stay open (the
 * per-instance cap answers 503, a proxy kills it, no EventSource), the page
 * polls instead. As a last line, a page still waiting when the reveal time
 * passes asks once on its own, so nobody is left staring at the "?".
 *
 * `offsetMs` is server time minus this device's clock, so countdowns use the
 * shop's clock rather than a phone that is a minute off.
 */
export function useGiveawayLive(
  slug: GiveawaySlug,
  initial: GiveawaySnapshot | null,
) {
  const [snapshot, setSnapshot] = useState<GiveawaySnapshot | null>(initial);
  const [offsetMs, setOffsetMs] = useState(() =>
    initial ? Date.parse(initial.serverTime) - Date.now() : 0,
  );
  const [transport, setTransport] = useState<GiveawayTransport>('connecting');
  const latest = useRef<GiveawaySnapshot | null>(initial);

  const apply = useCallback((next: GiveawaySnapshot) => {
    latest.current = next;
    setOffsetMs(Date.parse(next.serverTime) - Date.now());
    setSnapshot(next);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const next = await fetchGiveaway(slug);
      if (next) apply(next);
    } catch {
      // Offline for a moment; the next poll or event catches up.
    }
  }, [slug, apply]);

  // The stream, with polling as the fallback.
  useEffect(() => {
    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (poll) return;
      setTransport('polling');
      poll = setInterval(() => void refetch(), POLL_MS);
    };

    if (typeof EventSource === 'undefined') {
      startPolling();
    } else {
      try {
        source = new EventSource(giveawayEventsUrl(slug));
        source.addEventListener('open', () => {
          if (poll) {
            clearInterval(poll);
            poll = null;
          }
          setTransport('live');
        });
        source.addEventListener('giveaway', (event) => {
          try {
            apply(JSON.parse((event as MessageEvent<string>).data));
          } catch {
            // A malformed event is ignored; the next one replaces it.
          }
        });
        source.addEventListener('error', () => {
          // CONNECTING = the browser is retrying on its own; CLOSED = it gave
          // up (a 503 from the cap, for example), so poll from here on.
          if (source?.readyState === EventSource.CLOSED) startPolling();
          else setTransport('connecting');
        });
      } catch {
        startPolling();
      }
    }

    // A tab coming back from the background may have slept through events.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      source?.close();
      if (poll) clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug, apply, refetch]);

  // The reveal backstop.
  const revealAt = snapshot?.revealAt;
  const state = snapshot?.state;
  useEffect(() => {
    if (!revealAt || (state !== 'OPEN' && state !== 'DRAWN')) return;
    const wait = Date.parse(revealAt) - (Date.now() + offsetMs) + REVEAL_GRACE_MS;
    if (wait > 86_400_000) return;
    const timer = setTimeout(() => void refetch(), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [revealAt, state, offsetMs, refetch]);

  return { snapshot, offsetMs, transport };
}

/** A clock that ticks every `ms`, corrected to the server's time. */
export function useServerNow(offsetMs: number, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offsetMs), ms);
    return () => clearInterval(id);
  }, [offsetMs, ms]);
  return now;
}

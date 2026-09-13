'use client';

import React from 'react';

/**
 * Load a module of CLOSED overlays after the page has finished loading — or at
 * once, the moment one of them is asked for (#76).
 *
 * ## Why
 *
 * The search sheet, the mobile menu sheet, the desktop category dropdown and
 * the support chat panel are mounted on every page, closed, so they shipped in
 * the first-load JavaScript of every route. Measured on a production build
 * (Chrome, 393px, 4x CPU, 1.6 Mbps): not shipping them took the initial JS from
 * 268 KB to 241 KB, first contentful paint from ~1700 ms to ~1480 ms and main
 * thread blocking from ~900 ms to ~700 ms. LCP did not move — that is the hero
 * image, see the issue.
 *
 * ## Why not `next/dynamic`
 *
 * With `ssr: true` React fetches the chunk immediately to hydrate the server
 * markup, i.e. in exactly the window this is trying to clear (measured on #74).
 * With `ssr: false` the chunk still starts loading on first render. Neither
 * waits for the `load` event, which is what keeps these bytes out of the way of
 * the hero image.
 *
 * ## What it preserves
 *
 * Every overlay here animates open from a mounted, closed state. So the module
 * is loaded during idle time and the overlays mount closed long before anyone
 * reaches for them — after that, behaviour is exactly what it was. Should
 * someone open one before that (a tap in the first seconds of a slow load), the
 * load starts at once, the overlay mounts closed, and `armed` turns true two
 * frames later so the opening transition still plays rather than snapping.
 *
 * The loader must be a stable, module-level function: it is the cache key, so
 * a component that remounts on navigation (every page builds its own Header)
 * gets the already-loaded module synchronously instead of waiting again.
 */
const cache = new WeakMap<() => Promise<unknown>, unknown>();
const inflight = new WeakMap<() => Promise<unknown>, Promise<unknown>>();

function start<T>(load: () => Promise<T>): Promise<T> {
  let p = inflight.get(load) as Promise<T> | undefined;
  if (!p) {
    p = load().then((mod) => {
      cache.set(load, mod);
      return mod;
    });
    // A failed chunk (offline, a deploy swapped the files) must be retryable
    // by the next request rather than cached as a rejection forever.
    p.catch(() => inflight.delete(load));
    inflight.set(load, p);
  }
  return p;
}

export function useIdleImport<T>(
  load: () => Promise<T>,
  neededNow: boolean,
): { mod: T | null; armed: boolean } {
  const [mod, setMod] = React.useState<T | null>(() => (cache.get(load) as T | undefined) ?? null);
  // Already loaded at mount: nothing is mid-transition, so it is armed at once.
  const [armed, setArmed] = React.useState(() => cache.has(load));

  React.useEffect(() => {
    if (mod) return;
    let cancelled = false;
    const resolve = () => {
      start(load).then(
        (m) => { if (!cancelled) setMod(() => m); },
        () => {},
      );
    };

    if (neededNow) {
      resolve();
      return () => { cancelled = true; };
    }

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(resolve, { timeout: 3000 });
      } else {
        timeoutId = setTimeout(resolve, 1);
      }
    };
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', whenIdle);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [load, mod, neededNow]);

  React.useEffect(() => {
    if (!mod || armed) return;
    // Two frames: the first lets the closed state be committed, the second
    // runs after it has been painted, so flipping to open is a real transition.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setArmed(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [mod, armed]);

  return { mod, armed };
}

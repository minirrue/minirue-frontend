'use client';

/**
 * The sets the bag is holding, by id.
 *
 * ## Why this exists at all
 *
 * `GET /v1/cart` stamps every member row of a set with `bundleId` — the
 * server's own identifier for the thing the shopper bought — but carries no
 * display copy: not the set's name, not its photo, not its slug. Nor does it
 * for an ordinary variant line; the cart API has never returned any. So the
 * bag has the identity of the set and nothing to call it.
 *
 * `GET /v1/bundles` is the shop's own list of sets, keyed by exactly that id.
 * Looking the name up there is not a second source of truth and cannot
 * disagree with the cart: it is one server answering about one id it issued.
 * A name edited in the dashboard shows up here on the next load, which is the
 * behaviour you want.
 *
 * ## Where it can still fall short, precisely
 *
 * `listPublic()` returns only sets that are active, unexpired and not
 * owner-scoped. A set that is withdrawn while it sits in someone's bag
 * therefore drops out of this index, and that line falls back to a generic
 * label (`UNNAMED_BUNDLE_LABEL`) — never to a UUID, but never to its real
 * name either. The fix for that is a backend one, and it is small:
 * `CartItemDto` should carry `bundleName` / `bundleSlug` / `bundleImageUrl`
 * on a bundle line. Those fields are already declared optional in
 * `lib/api/cart.ts` and are preferred over this lookup in `bag-lines.ts`, so
 * the day the API sends them this hook becomes a fallback and then dead code.
 *
 * ## One request, and only when there is a set in the bag
 *
 * Hoisted to the module so the drawer and the cart page share the read, and
 * gated on `enabled` so a bag of ordinary products never pays for it.
 */

import React from 'react';
import { listBundles, type Bundle } from '@/lib/api/bundles';
import type { BundleIndex } from './bag-lines';

let bundleIndexPromise: Promise<BundleIndex> | null = null;

/** Test seam: drops the memoised read so each case starts clean. */
export function resetBundleCatalogCache(): void {
  bundleIndexPromise = null;
}

async function loadBundleIndex(): Promise<BundleIndex> {
  const bundles: Bundle[] = await listBundles();
  return new Map(bundles.map((b) => [b.id, b]));
}

const EMPTY: BundleIndex = new Map();

/**
 * Start the read before anything needs it.
 *
 * `addBundle` calls this as it fires `POST /v1/cart/bundles`, so the two
 * requests race instead of queueing: without it the drawer opens on the add's
 * response and only THEN asks what the set is called, and the shopper watches
 * a generic label become the real name. Safe to call any number of times — it
 * starts at most one read per page load.
 */
export function primeBundleIndex(): void {
  bundleIndexPromise ??= loadBundleIndex().catch((e: unknown) => {
    bundleIndexPromise = null;
    throw e;
  });
  // Nothing awaits it here; the hook adopts the same promise when it mounts.
  void bundleIndexPromise.catch(() => {});
}

export function useBundleIndex(enabled: boolean): BundleIndex {
  const [index, setIndex] = React.useState<BundleIndex>(EMPTY);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    bundleIndexPromise ??= loadBundleIndex().catch((e: unknown) => {
      // Don't memoise a failure — a set that could not be named now should get
      // another chance on the next mount rather than being stuck generic for
      // the life of the tab.
      bundleIndexPromise = null;
      throw e;
    });
    void bundleIndexPromise.then(
      (next) => {
        if (!cancelled) setIndex(next);
      },
      () => {
        // The bag still renders: a set keeps its price, its photo slot and a
        // generic name. Nothing here is allowed to blank the cart.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return index;
}

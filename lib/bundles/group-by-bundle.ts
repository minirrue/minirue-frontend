/**
 * A set is stored as one row per member; a shopper bought ONE thing.
 *
 * The cart API and the order API both return a set as its member rows, each
 * stamped with `bundleId` (which set) and `bundleLineKey` (which add). Every
 * screen that lists what a shopper is buying or has bought must fold those rows
 * back into one line. The bag learned that in #56; the order screens did not,
 * and after checkout the set fell apart into its parts again (#116).
 *
 * This is the one place that folding lives. Pure — no React, no fetching — so
 * the bag (`components/storefront/cart/bag-lines.ts`) and the orders
 * (`lib/orders/order-lines.ts`) cannot drift apart.
 */

export type BundleGroup<T> =
  | { kind: 'item'; row: T }
  | { kind: 'bundle'; bundleId: string; rows: T[] };

/**
 * Standalone rows stay single; every row of a set joins one group.
 *
 * Grouped by `bundleId`, NOT `bundleLineKey`: the key identifies one add, so
 * buying the same set twice would otherwise show the set twice. By id, the
 * second add reads as quantity 2.
 *
 * Order is preserved — a group sits where its first row was.
 */
export function groupRowsByBundle<T extends { bundleId?: string | null }>(
  rows: T[],
): BundleGroup<T>[] {
  const groups: BundleGroup<T>[] = [];
  const bundleSlots = new Map<string, Extract<BundleGroup<T>, { kind: 'bundle' }>>();

  for (const row of rows) {
    const bundleId = row.bundleId ?? null;
    if (!bundleId) {
      groups.push({ kind: 'item', row });
      continue;
    }
    const existing = bundleSlots.get(bundleId);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    const group = { kind: 'bundle' as const, bundleId, rows: [row] };
    bundleSlots.set(bundleId, group);
    groups.push(group);
  }

  return groups;
}

/**
 * How many whole sets a group of member rows holds.
 *
 * What every member agrees on — `min`, so a half-edited group reads DOWN, never
 * up; showing 2 sets when only one is complete is the version that
 * overcharges. A variant missing from `unitsPerVariant` counts one per set,
 * which is true of every set the shop sells. Never less than 1.
 */
export function setQtyFromRows(
  rows: Array<{ variantId: string; qty: number }>,
  unitsPerVariant: Map<string, number> = new Map(),
): number {
  // A member the definition names but no row holds counts as zero of it.
  const qtyByVariant = new Map<string, number>([...unitsPerVariant.keys()].map((v) => [v, 0]));
  for (const row of rows) {
    qtyByVariant.set(row.variantId, (qtyByVariant.get(row.variantId) ?? 0) + row.qty);
  }
  let qty = Infinity;
  for (const [variantId, total] of qtyByVariant) {
    qty = Math.min(qty, Math.floor(total / Math.max(1, unitsPerVariant.get(variantId) ?? 1)));
  }
  return Math.max(1, Number.isFinite(qty) ? qty : 1);
}

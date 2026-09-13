/**
 * What the bag SHOWS, assembled from what the cart API returns.
 *
 * The two are not the same shape and cannot be, which is the whole of #56.
 *
 * `GET /v1/cart` returns one row per VARIANT. A set is deliberately stored
 * that way — the backend writes every member as a real cart line so stock
 * checks, fulfilment, refunds and the dashboard's order breakdown all keep
 * working on actual products — and stamps each of those rows with the set it
 * came from (`bundleId`) and the add it came from (`bundleLineKey`). See
 * `src/cart/interfaces/cart.interfaces.ts` in the backend.
 *
 * The bag rendered those rows one-for-one, so a two-piece set arrived as two
 * removable half-sets, each priced at its allocated share and each labelled
 * `Variant #<uuid>` because the cart API carries no display copy at all. This
 * module is the missing translation: rows in, one line per thing-the-shopper-
 * bought out.
 *
 * Pure on purpose — no React, no fetching. Everything it needs about a set is
 * passed in as a `bundleIndex`, so the grouping can be tested without a
 * network and so the day the API starts sending the set's name on the line
 * itself (see `bundleName` in lib/api/cart.ts) only the lookup order changes.
 */

import type { CartItemDto } from '@/lib/api/cart';
import type { Bundle } from '@/lib/api/bundles';
import { groupRowsByBundle, setQtyFromRows } from '@/lib/bundles/group-by-bundle';

/** BR-CART-002: the backend rejects any single cart row above this. */
export const POLICY_MAX = 10;

/**
 * Shown when nothing knows what a line is called.
 *
 * It replaces `Variant #${item.variantId}`, which put a database identifier on
 * the screen where the product name belongs, next to a price, on the one
 * screen where the shopper is deciding whether to trust the total. A raw UUID
 * is never useful copy: it tells a customer nothing and tells support nothing
 * they could not get from the order.
 *
 * This is a floor, not a fix. A standalone line's name comes from the
 * add-to-bag enrichment cache (lib/cart/enrichment.ts) because the cart API
 * does not send one; the real repair is the API sending it. See the PR for
 * the exact contract.
 */
export const UNNAMED_LINE_LABEL = 'Item';

/** Shown for a set whose definition we could not look up (deactivated, expired). */
export const UNNAMED_BUNDLE_LABEL = 'Gift set';

/**
 * One row in the bag as a customer reads it: one product, or one whole set.
 *
 * `items` is the set of underlying cart rows it stands for — one for an
 * ordinary line, one per member (times however many times the set was added)
 * for a bundle. Every mutation goes back through those rows, so the server
 * still only ever sees real variant lines.
 */
export interface BagLine {
  /** Stable React key, and the identity the cart context mutates by. */
  key: string;
  kind: 'item' | 'bundle';
  /** The cart rows this line stands for. Never empty. */
  items: CartItemDto[];
  bundleId: string | null;
  /** `/bundles/<slug>` when the set is known, so the line links to its page. */
  href: string | null;
  name: string;
  imageUrl: string | null;
  cloudinaryPublicId: string | null;
  altText: string;
  /** brand · size · bottle for a product; the member list for a set. */
  meta: string | null;
  /** How many of this thing — SETS for a bundle, not member units. */
  qty: number;
  currency: string;
  /** Per set / per unit. For a set this is the set's own price. */
  unitPriceAmount: string;
  lineTotalAmount: string;
  /** Ceiling for the stepper, already accounting for stock and the flat cap. */
  maxQty: number;
  /**
   * True when `maxQty` is a real scarcity signal rather than the flat policy
   * cap — the only case where saying "Only N left" is not a lie.
   */
  scarce: boolean;
  /**
   * How many units of each variant one of these consumes. For a set this is
   * the member quantities; `setLineQty` multiplies through it, so a set at
   * qty 2 reserves 2 of every component.
   */
  unitsPerVariant: Map<string, number>;
}

export type BundleIndex = Map<string, Bundle>;

// ── Money ────────────────────────────────────────────────────────────────────

function toMinor(amount: string): number {
  const n = parseFloat(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

// ── Grouping ─────────────────────────────────────────────────────────────────

/**
 * Group the cart's rows into the lines the bag renders.
 *
 * The folding itself is `groupRowsByBundle`, shared with the order screens
 * (#116) so a set reads as one line before AND after checkout. It groups by
 * `bundleId`, NOT by `bundleLineKey`: adding the same set twice reads as
 * quantity 2, and `setLineQty` collapses the duplicate rows the first time the
 * stepper is touched. Order is preserved, so nothing jumps around when a
 * quantity changes.
 */
export function groupBagLines(
  items: CartItemDto[],
  bundleIndex: BundleIndex = new Map(),
): BagLine[] {
  return groupRowsByBundle(items).map((group) =>
    group.kind === 'item'
      ? standaloneLine(group.row)
      : bundleLine(group.bundleId, group.rows, bundleIndex.get(group.bundleId)),
  );
}

function standaloneLine(item: CartItemDto): BagLine {
  const available =
    typeof item.availableQuantity === 'number' ? item.availableQuantity : POLICY_MAX;
  const maxQty = Math.max(1, Math.min(POLICY_MAX, available));
  const meta = [item.brand, item.sizeMl ? `${item.sizeMl} ml` : null, item.bottleType]
    .filter(Boolean)
    .join(' · ');

  return {
    key: item.id,
    kind: 'item',
    items: [item],
    bundleId: null,
    href: null,
    name: item.name ?? UNNAMED_LINE_LABEL,
    imageUrl: item.imageUrl ?? null,
    cloudinaryPublicId: item.cloudinaryPublicId ?? null,
    altText: item.altText ?? item.name ?? UNNAMED_LINE_LABEL,
    meta: meta || null,
    qty: item.qty,
    currency: item.unitPriceCurrency,
    unitPriceAmount: item.unitPriceAmount,
    lineTotalAmount: item.lineTotalAmount,
    maxQty,
    scarce: maxQty < POLICY_MAX,
    unitsPerVariant: new Map([[item.variantId, 1]]),
  };
}

function bundleLine(
  bundleId: string,
  rows: CartItemDto[],
  bundle: Bundle | undefined,
): BagLine {
  /**
   * How many units of each member one set consumes.
   *
   * From the set's own definition when we have it. Without it — the set was
   * deactivated or expired after it went in the bag, so `GET /v1/bundles` no
   * longer lists it — every member is assumed to be one per set. That is true
   * of every set the shop sells today, and the only thing it can get wrong is
   * the displayed quantity of a set that has since been withdrawn.
   */
  const unitsPerVariant = new Map<string, number>();
  if (bundle) {
    for (const m of bundle.members) {
      if (!m.variantId) continue;
      unitsPerVariant.set(
        m.variantId,
        (unitsPerVariant.get(m.variantId) ?? 0) + Math.max(1, m.quantity),
      );
    }
  }
  for (const row of rows) {
    if (!unitsPerVariant.has(row.variantId)) unitsPerVariant.set(row.variantId, 1);
  }

  const availableByVariant = new Map<string, number>();
  for (const row of rows) {
    const available =
      typeof row.availableQuantity === 'number' ? row.availableQuantity : POLICY_MAX;
    availableByVariant.set(
      row.variantId,
      Math.min(availableByVariant.get(row.variantId) ?? Infinity, available),
    );
  }

  // The set quantity is whatever every member agrees on — the same rule the
  // order screens use, so a bag of 2 sets is a receipt of 2 sets.
  const qty = setQtyFromRows(rows, unitsPerVariant);
  let maxQty = POLICY_MAX;
  for (const [variantId, perSet] of unitsPerVariant) {
    const available = availableByVariant.get(variantId) ?? POLICY_MAX;
    // A single cart ROW is capped at 10 by the backend, so a member that takes
    // two units per set caps the set at 5.
    maxQty = Math.min(
      maxQty,
      Math.floor(POLICY_MAX / perSet),
      Math.floor(available / perSet),
    );
  }
  maxQty = Math.max(qty, maxQty);

  // The price is what the server charged for these rows — the set price,
  // allocated across the members — never the sum of the parts' list prices
  // and never recomputed here.
  const lineTotalMinor = rows.reduce((sum, r) => sum + toMinor(r.lineTotalAmount), 0);
  const first = rows[0];
  const memberNames = (bundle?.members ?? [])
    .map((m) => m.productName)
    .filter(Boolean);

  return {
    key: `bundle:${bundleId}`,
    kind: 'bundle',
    items: rows,
    bundleId,
    href: bundle ? `/bundles/${bundle.slug}` : null,
    name: first?.bundleName ?? bundle?.name ?? UNNAMED_BUNDLE_LABEL,
    imageUrl: first?.bundleImageUrl ?? bundle?.imageUrl ?? null,
    cloudinaryPublicId: null,
    altText: first?.bundleName ?? bundle?.name ?? UNNAMED_BUNDLE_LABEL,
    meta: memberNames.length ? memberNames.join(' + ') : null,
    qty,
    currency: first?.unitPriceCurrency ?? 'EGP',
    unitPriceAmount: toAmount(Math.round(lineTotalMinor / qty)),
    lineTotalAmount: toAmount(lineTotalMinor),
    maxQty,
    scarce: maxQty < POLICY_MAX,
    unitsPerVariant,
  };
}

// ── Mutation plan ────────────────────────────────────────────────────────────

export type BagWrite =
  | { op: 'patch'; itemId: string; qty: number }
  | { op: 'delete'; itemId: string };

/**
 * The API calls that take a line from its current quantity to `nextQty`.
 *
 * Returned rather than performed so the arithmetic — the part that decides how
 * much stock a shopper reserves and how much they are charged — is testable
 * without mocking the network.
 *
 * For a set this is where "one line, one quantity" is paid for: each member's
 * row is set to `nextQty × unitsPerSet`, so a set at 2 reserves 2 of every
 * component rather than 1 line of 1. Where an older bag holds the same set on
 * several rows for one variant (two separate adds), the first row absorbs the
 * whole total and the rest are deleted — so the bag normalises itself the
 * first time the stepper is touched, without a migration.
 */
export function planSetQty(line: BagLine, nextQty: number): BagWrite[] {
  if (nextQty <= 0) return line.items.map((i) => ({ op: 'delete', itemId: i.id }));

  const writes: BagWrite[] = [];
  const rowsByVariant = new Map<string, CartItemDto[]>();
  for (const row of line.items) {
    const list = rowsByVariant.get(row.variantId);
    if (list) list.push(row);
    else rowsByVariant.set(row.variantId, [row]);
  }

  for (const [variantId, rows] of rowsByVariant) {
    const target = nextQty * (line.unitsPerVariant.get(variantId) ?? 1);
    const [keep, ...extra] = rows;
    if (keep.qty !== target) writes.push({ op: 'patch', itemId: keep.id, qty: target });
    for (const row of extra) writes.push({ op: 'delete', itemId: row.id });
  }

  return writes;
}

// ── Discount eligibility ─────────────────────────────────────────────────────

export interface BagPricingLine {
  variantId: string;
  qty: number;
  unitPriceMinor: number;
  bundleId?: string | null;
  bundleLineKey?: string;
  bundleListTotalMinor?: number;
}

/**
 * The bag in the shape `POST /v1/discounts/preview` wants — WITH the bundle
 * markers on it.
 *
 * The bundle page promises "Discount codes do not apply to sets", and the
 * server honours that: `priceBag()` filters to `isMinirueOwned && !bundleId`.
 * But the cart was building this payload from `{variantId, qty,
 * unitPriceMinor}` only, so every member of every set arrived looking like an
 * ordinary line and was priced as eligible — the preview offered a saving on
 * top of the set's own, which checkout would then refuse to give.
 *
 * `bundleListTotalMinor` is scaled by the set quantity because the server
 * compares it against the paid total of every row sharing that key, and after
 * `planSetQty` normalises a bag those rows hold N sets, not one.
 */
export function toPricingLines(
  lines: BagLine[],
  bundleIndex: BundleIndex = new Map(),
): BagPricingLine[] {
  const out: BagPricingLine[] = [];
  for (const line of lines) {
    const listTotal =
      line.bundleId !== null
        ? bundleIndex.get(line.bundleId)?.listTotalMinor
        : undefined;
    const setsPerKey = setsByBundleLineKey(line);
    for (const item of line.items) {
      const sets = item.bundleLineKey ? (setsPerKey.get(item.bundleLineKey) ?? 1) : 1;
      out.push({
        variantId: item.variantId,
        qty: item.qty,
        unitPriceMinor: toMinor(item.unitPriceAmount),
        ...(item.bundleId ? { bundleId: item.bundleId } : {}),
        ...(item.bundleLineKey ? { bundleLineKey: item.bundleLineKey } : {}),
        ...(typeof listTotal === 'number'
          ? { bundleListTotalMinor: listTotal * sets }
          : {}),
      });
    }
  }
  return out;
}

/**
 * How many sets each `bundleLineKey` within a line holds.
 *
 * The server counts a set's saving once per KEY, not once per line, so a bag
 * that still holds two separate adds of the same set (see `groupBagLines`)
 * has to declare each key's own list total or the saving is double-counted.
 */
function setsByBundleLineKey(line: BagLine): Map<string, number> {
  const qtyByKeyVariant = new Map<string, Map<string, number>>();
  for (const item of line.items) {
    if (!item.bundleLineKey) continue;
    const byVariant = qtyByKeyVariant.get(item.bundleLineKey) ?? new Map();
    byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.qty);
    qtyByKeyVariant.set(item.bundleLineKey, byVariant);
  }

  const sets = new Map<string, number>();
  for (const [key, byVariant] of qtyByKeyVariant) {
    let n = Infinity;
    for (const [variantId, total] of byVariant) {
      n = Math.min(n, Math.floor(total / (line.unitsPerVariant.get(variantId) ?? 1)));
    }
    sets.set(key, Math.max(1, Number.isFinite(n) ? n : 1));
  }
  return sets;
}

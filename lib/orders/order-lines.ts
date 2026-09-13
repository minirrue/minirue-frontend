/**
 * What an order SHOWS, assembled from the rows the order API returns (#116).
 *
 * The backend keeps a set as one `order_items` row per member — right for
 * stock, fulfilment and refunds, which all work on real products. A shopper did
 * not buy two products, though; they bought "Evening Set". So every screen that
 * lists what was bought (step 4 confirmation, the Orders tab, the order detail)
 * renders these lines, never the rows.
 *
 * Grouping is the bag's (`lib/bundles/group-by-bundle.ts`), so the bag and the
 * receipt agree on what one line is. Degrades on an API that does not send the
 * set (`item.bundle`, backend 0.113.0): the members still fold into one line,
 * called "Set", shown with the first member's picture.
 */

import { groupRowsByBundle, setQtyFromRows } from '@/lib/bundles/group-by-bundle';
import type { OrderItemSummary } from '@/lib/checkout/checkout-api';
import { productPath } from '@/lib/routes';

/** A set whose name the API did not send (older backend, or a deleted set). */
export const UNNAMED_SET_LABEL = 'Set';
export const UNNAMED_ITEM_LABEL = 'Item';

export interface OrderLineMember {
  key: string;
  name: string;
  /** The product page, or null when the API sent no slug — never a guessed URL. */
  href: string | null;
}

export interface OrderLine {
  key: string;
  kind: 'item' | 'bundle';
  name: string;
  imageUrl: string | null;
  /** brand for a product; null for a set. */
  brand: string | null;
  /** "50 Size (ml)"-style picks for a product; null for a set. */
  detail: string | null;
  /** SETS for a set, not member units. */
  qty: number;
  /** Decimal string; always render through formatMoney. */
  lineTotalAmount: string;
  /** "What's in this set" — empty for a product. */
  members: OrderLineMember[];
  /** The rows this line stands for. */
  items: OrderItemSummary[];
}

function toMinor(amount: string | undefined): number {
  const n = parseFloat(amount ?? '');
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function hrefOf(item: OrderItemSummary): string | null {
  const slug = item.productSnapshot?.productSlug;
  return slug ? productPath({ slug, categorySlug: item.productSnapshot?.categorySlug }) : null;
}

function detailOf(item: OrderItemSummary): string | null {
  const detail = Object.entries(item.productSnapshot?.variantValues ?? {})
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
  return detail || null;
}

export function groupOrderLines(items: OrderItemSummary[] | undefined | null): OrderLine[] {
  return groupRowsByBundle(items ?? []).map((group): OrderLine => {
    if (group.kind === 'item') {
      const item = group.row;
      return {
        key: item.id,
        kind: 'item',
        name: item.productSnapshot?.name ?? UNNAMED_ITEM_LABEL,
        imageUrl: item.productSnapshot?.imageUrl ?? null,
        brand: item.productSnapshot?.brand ?? null,
        detail: detailOf(item),
        qty: item.qty,
        lineTotalAmount: item.lineTotalAmount,
        members: [],
        items: [item],
      };
    }

    const rows = group.rows;
    const bundle = rows.find((r) => r.bundle)?.bundle ?? null;

    /*
     * The set count frozen at checkout, summed per add, when every add has one.
     * Otherwise derived from the rows like the bag does — which assumes one of
     * each member per set, true of every set the shop sells.
     */
    const setQtyByKey = new Map<string, number | null>();
    for (const r of rows) {
      const key = r.bundleLineKey || r.id;
      if (!setQtyByKey.has(key)) setQtyByKey.set(key, r.bundle?.setQty ?? null);
    }
    const frozen = [...setQtyByKey.values()];
    const qty = frozen.every((n): n is number => typeof n === 'number' && n > 0)
      ? frozen.reduce((a, b) => a + b, 0)
      : setQtyFromRows(rows);

    const members: OrderLineMember[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.variantId)) continue;
      seen.add(r.variantId);
      members.push({
        key: r.variantId,
        name: r.productSnapshot?.name ?? UNNAMED_ITEM_LABEL,
        href: hrefOf(r),
      });
    }

    // The price is what was charged for these rows — the set price as
    // allocated across its members — never recomputed from list prices.
    const totalMinor = rows.reduce((sum, r) => sum + toMinor(r.lineTotalAmount), 0);

    return {
      key: `bundle:${group.bundleId}`,
      kind: 'bundle',
      name: bundle?.name ?? UNNAMED_SET_LABEL,
      imageUrl:
        bundle?.imageUrl ?? rows.find((r) => r.productSnapshot?.imageUrl)?.productSnapshot?.imageUrl ?? null,
      brand: null,
      detail: null,
      qty,
      lineTotalAmount: (totalMinor / 100).toFixed(2),
      members,
      items: rows,
    };
  });
}

/** Whether an order's set savings are worth a line in the totals. */
export function hasSetSavings(amount: string | null | undefined): amount is string {
  return toMinor(amount ?? undefined) > 0;
}

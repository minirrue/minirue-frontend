import { catalog, mediaImageUrl, primaryMedia, productBrand, variantInStock, variantLabel, type ApiProduct, type ProductVariant } from '@/lib/api/catalog';
import { listBundles, type Bundle } from '@/lib/api/bundles';
import { apiAddBundle, apiAddItem, type CartItemDto } from '@/lib/api/cart';
import { cacheVariantEnrichment, type VariantEnrichment } from '@/lib/cart/enrichment';
import type { OrderItemSummary } from '@/lib/checkout/checkout-api';
import { groupOrderLines } from './order-lines';

const CART_QTY_LIMIT = 10;
const RESULT_KEY = 'mr-rebuy-result-v1';

export type RebuyIssueKind = 'unavailable' | 'quantity-adjusted';

export interface RebuyIssue {
  name: string;
  kind: RebuyIssueKind;
  requestedQty: number;
  addedQty: number;
}

export interface RebuyResult {
  addedLines: number;
  addedQty: number;
  issues: RebuyIssue[];
}

interface ItemAction {
  kind: 'item';
  name: string;
  variantId: string;
  qty: number;
  requestedQty: number;
  enrichment: VariantEnrichment;
}

interface BundleAction {
  kind: 'bundle';
  name: string;
  slug: string;
  qty: number;
  requestedQty: number;
}

export type RebuyAction = ItemAction | BundleAction;

export interface RebuyPlan {
  actions: RebuyAction[];
  issues: RebuyIssue[];
}

interface LiveVariant {
  product: ApiProduct;
  variant: ProductVariant;
}

let memoryResult: RebuyResult | null = null;

function availableCapacity(variant: ProductVariant, held: number): number {
  if (!variant.isActive || !variantInStock(variant)) return 0;
  const stock = typeof variant.availableQuantity === 'number'
    ? variant.availableQuantity
    : CART_QTY_LIMIT;
  return Math.max(0, Math.min(CART_QTY_LIMIT, stock) - held);
}

function enrichment(product: ApiProduct, variant: ProductVariant): VariantEnrichment {
  const media = primaryMedia(product);
  return {
    productId: product.id,
    name: product.name,
    brand: productBrand(product) ?? undefined,
    sizeMl: variant.sizeMl ?? undefined,
    bottleType: variant.bottleType ?? variantLabel(variant),
    cloudinaryPublicId: media?.cloudinaryPublicId,
    imageUrl: media ? mediaImageUrl(media, { w: 160, h: 200 }) ?? undefined : undefined,
    altText: media?.altText,
  };
}

/**
 * Plans against one live catalogue snapshot and the bag that already exists.
 * The planner mutates only its private `held` map, so repeated variants across
 * a product and a set share the same stock/cap budget before any request runs.
 */
export function planRebuy(
  items: OrderItemSummary[],
  products: ApiProduct[],
  bundles: Bundle[],
  cartItems: CartItemDto[],
): RebuyPlan {
  const variants = new Map<string, LiveVariant>();
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      variants.set(variant.id, { product, variant });
    }
  }

  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const bundleBySlug = new Map(bundles.map((bundle) => [bundle.slug, bundle]));
  const held = new Map<string, number>();
  for (const item of cartItems) {
    held.set(item.variantId, (held.get(item.variantId) ?? 0) + item.qty);
  }

  const actions: RebuyAction[] = [];
  const issues: RebuyIssue[] = [];

  for (const line of groupOrderLines(items)) {
    if (line.kind === 'item') {
      const row = line.items[0];
      const live = variants.get(row.variantId);
      const requestedQty = Math.max(1, line.qty);
      const capacity = live ? availableCapacity(live.variant, held.get(row.variantId) ?? 0) : 0;
      const qty = Math.min(requestedQty, capacity);

      if (!live || qty === 0) {
        issues.push({ name: line.name, kind: 'unavailable', requestedQty, addedQty: 0 });
        continue;
      }

      actions.push({
        kind: 'item',
        name: line.name,
        variantId: row.variantId,
        qty,
        requestedQty,
        enrichment: enrichment(live.product, live.variant),
      });
      held.set(row.variantId, (held.get(row.variantId) ?? 0) + qty);
      if (qty < requestedQty) {
        issues.push({ name: line.name, kind: 'quantity-adjusted', requestedQty, addedQty: qty });
      }
      continue;
    }

    const snapshot = line.items.find((item) => item.bundle)?.bundle;
    const liveBundle = (snapshot?.id ? bundleById.get(snapshot.id) : undefined)
      ?? (snapshot?.slug ? bundleBySlug.get(snapshot.slug) : undefined);
    const requestedQty = Math.max(1, line.qty);

    if (!liveBundle?.inStock || !liveBundle.members.length) {
      issues.push({ name: line.name, kind: 'unavailable', requestedQty, addedQty: 0 });
      continue;
    }

    let capacity = CART_QTY_LIMIT;
    for (const member of liveBundle.members) {
      const live = member.variantId ? variants.get(member.variantId) : undefined;
      if (!live || !member.variantId) {
        capacity = 0;
        break;
      }
      const memberCapacity = availableCapacity(live.variant, held.get(member.variantId) ?? 0);
      capacity = Math.min(capacity, Math.floor(memberCapacity / Math.max(1, member.quantity)));
    }

    const qty = Math.min(requestedQty, capacity);
    if (qty === 0) {
      issues.push({ name: line.name, kind: 'unavailable', requestedQty, addedQty: 0 });
      continue;
    }

    actions.push({ kind: 'bundle', name: line.name, slug: liveBundle.slug, qty, requestedQty });
    for (const member of liveBundle.members) {
      if (!member.variantId) continue;
      held.set(
        member.variantId,
        (held.get(member.variantId) ?? 0) + qty * Math.max(1, member.quantity),
      );
    }
    if (qty < requestedQty) {
      issues.push({ name: line.name, kind: 'quantity-adjusted', requestedQty, addedQty: qty });
    }
  }

  return { actions, issues };
}

/** Reads every current catalogue page because an order carries variant ids, not product ids. */
export async function loadRebuyPlan(items: OrderItemSummary[], cartItems: CartItemDto[]): Promise<RebuyPlan> {
  const products: ApiProduct[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await catalog.listProducts({ limit: 100, cursor });
    products.push(...page.data);
    const next = page.meta.hasMore && page.meta.cursor ? page.meta.cursor : undefined;
    // A malformed repeated cursor must not leave the button spinning forever.
    cursor = next && !seenCursors.has(next) ? next : undefined;
    if (cursor) seenCursors.add(cursor);
  } while (cursor);

  const bundles = await listBundles();
  return planRebuy(items, products, bundles, cartItems);
}

export async function executeRebuyPlan(plan: RebuyPlan): Promise<RebuyResult> {
  const result: RebuyResult = { addedLines: 0, addedQty: 0, issues: [...plan.issues] };

  for (const action of plan.actions) {
    let added = 0;
    try {
      if (action.kind === 'item') {
        await apiAddItem(action.variantId, action.qty);
        added = action.qty;
      } else {
        for (let i = 0; i < action.qty; i += 1) {
          await apiAddBundle(action.slug);
          added += 1;
        }
      }
    } catch {
      // Stock can change between planning and mutation. Report the safe result
      // instead of retrying with a guessed quantity or hiding a partial add.
      if (added === 0) {
        result.issues.push({
          name: action.name,
          kind: 'unavailable',
          requestedQty: action.requestedQty,
          addedQty: 0,
        });
      } else {
        result.issues.push({
          name: action.name,
          kind: 'quantity-adjusted',
          requestedQty: action.requestedQty,
          addedQty: added,
        });
      }
    }

    if (added > 0) {
      result.addedLines += 1;
      result.addedQty += added;
      // Cache the same display data as a normal PDP add. Sets get their copy
      // from the bundle index, so only standalone products need enrichment.
      if (action.kind === 'item') {
        cacheVariantEnrichment(action.variantId, action.enrichment);
      }
    }
  }

  return result;
}

export function saveRebuyResult(result: RebuyResult): void {
  memoryResult = result;
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
  } catch {
    // The in-memory fallback still covers this tab when storage is disabled.
  }
}

export function consumeRebuyResult(): RebuyResult | null {
  let result = memoryResult;
  memoryResult = null;
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    sessionStorage.removeItem(RESULT_KEY);
    if (raw) result = JSON.parse(raw) as RebuyResult;
  } catch {
    // Keep the in-memory result.
  }
  return result;
}

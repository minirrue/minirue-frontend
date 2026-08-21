import { catalog, type Category } from '@/lib/api/catalog';
import { apiListPublicBrands } from '@/lib/api/collaborators';
import { categoryPath } from '@/lib/routes';

/**
 * The parts of the shop that are not products.
 *
 * Search matched product names only, so typing "helia" — the name of an actual
 * partner with an actual page — returned "No matches for HELIA" (owner,
 * 2026-08-21: "search here is global on anything, even collab names and brand
 * names and categories names, on any page"). The shop knew about Helia the
 * whole time; the search box only knew how to ask one question.
 *
 * WHY THIS IS MATCHED IN THE BROWSER, when product search is a server query
 * and deliberately so (see lib/shop/filters.ts, which argues the opposite case
 * for facets): the number of things being matched. Products are paginated and
 * unbounded, so filtering them client-side would mean "matches, among the 24
 * you happen to have" — a search that lies. Categories and partners are a
 * handful of rows each, small enough to hold entirely, and holding them
 * entirely is what makes the match exhaustive rather than partial. The two
 * lists are already fetched and cached for the nav and the /collab grid, so
 * this costs nothing extra on a warm cache.
 *
 * Brands, note, are NOT a third list. A partner IS a brand here — the
 * collaborator row carries brandName and brandSlug and owns /collab/{slug} —
 * so fetching a separate brand list would produce two results pointing at the
 * same page for the same word.
 */

export type DestinationKind = 'category' | 'partner';

export interface Destination {
  kind: DestinationKind;
  /** Stable across refetches, so React keys do not churn. */
  id: string;
  name: string;
  href: string;
  imageUrl: string | null;
  /** One line under the name — what this is, in the shop's own terms. */
  detail: string | null;
}

/**
 * Normalised for comparison: case-folded, accents stripped, and every
 * non-alphanumeric character removed.
 *
 * The last part is what makes "loccitane" find "L'Occitane" and "no5" find
 * "No. 5" — the same squashing the backend applies to product names
 * (products.name_normalised, migration 0170), so the two halves of one search
 * box do not disagree about what counts as a match.
 */
function squash(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function categoryDestinations(categories: Category[]): Destination[] {
  // Flattened, because a child category is a real page a shopper can be
  // looking for and nesting would hide it from search.
  const flat: Category[] = [];
  const walk = (nodes: Category[]) => {
    for (const node of nodes) {
      flat.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(categories);

  return flat.map((c) => ({
    kind: 'category' as const,
    id: `category:${c.id}`,
    name: c.name,
    href: categoryPath(c.slug),
    imageUrl: c.imageUrl ?? null,
    detail: 'Category',
  }));
}

/** Everything searchable that is not a product. One call, both lists. */
export async function loadDestinations(): Promise<Destination[]> {
  // Settled, not all: a partner list that fails must not take the category
  // results down with it. Search degrading to "products and categories" is a
  // worse search; search throwing is a broken one.
  const [categories, partners] = await Promise.allSettled([
    catalog.listCategories(),
    apiListPublicBrands(),
  ]);

  const out: Destination[] = [];

  if (categories.status === 'fulfilled') {
    out.push(...categoryDestinations(categories.value));
  }

  if (partners.status === 'fulfilled') {
    out.push(
      ...partners.value
        // A partner hidden from the storefront has no page to land on, so
        // surfacing them here would be a search result that 404s.
        .filter((p) => p.storefrontVisible !== false)
        .map((p) => ({
          kind: 'partner' as const,
          id: `partner:${p.collaboratorId}`,
          name: p.brandName,
          href: `/collab/${p.brandSlug}`,
          imageUrl: p.logoUrl ?? null,
          detail:
            p.productCount && p.productCount > 0
              ? `Brand · ${p.productCount} ${p.productCount === 1 ? 'product' : 'products'}`
              : 'Brand',
        })),
    );
  }

  return out;
}

/**
 * Which destinations a query names, best first.
 *
 * Ranked rather than merely filtered, because a shopper typing three letters
 * usually means the thing that STARTS with them. Without this, "per" could put
 * a partner called "Atelier Perle" above the Perfumes category, which is the
 * one they can see in the menu.
 */
export function matchDestinations(
  destinations: Destination[],
  term: string,
  limit = 4,
): Destination[] {
  const q = squash(term);
  if (q.length < 2) return [];

  return destinations
    .map((d) => {
      const name = squash(d.name);
      if (name === q) return { d, rank: 0 };
      if (name.startsWith(q)) return { d, rank: 1 };
      if (name.includes(q)) return { d, rank: 2 };
      return null;
    })
    .filter((v): v is { d: Destination; rank: number } => v !== null)
    .sort((a, b) => a.rank - b.rank || a.d.name.localeCompare(b.d.name))
    .slice(0, limit)
    .map((v) => v.d);
}

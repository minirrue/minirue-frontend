import { JsonLd } from "./JsonLd";
import type { ApiProduct } from "@/lib/api/catalog";
import {
  cheapestActiveVariant,
  mediaImageUrl,
  primaryMedia,
  productBrand,
  productInStock,
} from "@/lib/api/catalog";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

/**
 * A brand/space entry for the "brands" item mode. `/brands`, `/collab`, and a
 * single space's own brand tiles (`app/[slug]/SpaceView.tsx`) all normalise
 * to this shape before reaching the schema builder, so the builder never has
 * to know which page or API response an item came from.
 *
 * `url` is passed in fully resolved (absolute) by the caller rather than
 * built here from a slug, because the same kind of brand entity links to a
 * different place depending on which page lists it: a root-level partner
 * space from `/brands` and `/collab` (`${SITE_URL}/{slug}`), versus a nested
 * `/{space}/{brand}` child from that space's own page.
 */
export interface CollectionBrandItem {
  name: string;
  url: string;
  imageUrl?: string | null;
  description?: string | null;
}

type CollectionSchemaItems =
  | { kind: "products"; products: ApiProduct[] }
  | { kind: "brands"; brands: CollectionBrandItem[] };

interface CollectionSchemaProps {
  /** The page's own name, e.g. "All Products" or a category/space name. */
  name: string;
  /** Site-relative canonical path, e.g. "/products", "/categories/rings". */
  path: string;
  items: CollectionSchemaItems;
  /**
   * `@id` reference to another node this page is "about" — e.g. a partner's
   * Organization node (`SpaceOrganizationSchema`) on that partner's own
   * `/[slug]` page. Optional: most CollectionPages (the whole catalogue, a
   * category) aren't "about" any single addressable entity.
   */
  about?: { "@id": string };
}

/**
 * The `item` body for a single product ListItem — shared by
 * `buildCollectionSchema`'s products branch and `SearchResultsSchema`, so the
 * two describe a product identically and can never again drift the way they
 * did before this extraction (this schema emitted `sku`; SearchResultsSchema
 * quietly didn't, despite both being near-verbatim copies of the same
 * mapping).
 */
export function productListItem(product: ApiProduct): Record<string, unknown> {
  // The active variant priced lowest — also the one whose SKU actually
  // describes that price (Task 7's cheapestActiveVariant), so price and sku
  // on this item can never disagree about which variant they mean.
  const variant = cheapestActiveVariant(product);
  const brand = productBrand(product);
  const media = primaryMedia(product);
  const image = media ? mediaImageUrl(media, { w: 800, h: 1000 }) : null;
  // In stock if ANY active variant is — shared with ProductSchema and
  // SearchResultsSchema via productInStock() so no JSON-LD emitter on the
  // site can disagree about a product's availability.
  const inStock = productInStock(product);
  const productUrl = `${BASE_URL}/products/${product.slug}`;
  return {
    "@type": "Product",
    name: product.name,
    url: productUrl,
    ...(image ? { image } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(variant
      ? {
          sku: variant.sku,
          offers: {
            "@type": "Offer",
            // priceAmount is a Dinero string and is emitted as-is — parsing
            // it to a float here would round money for SEO.
            price: variant.priceAmount,
            priceCurrency: variant.priceCurrency,
            url: productUrl,
            itemCondition: "https://schema.org/NewCondition",
            availability: inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };
}

/**
 * Builds the CollectionPage + ItemList node from real page data only, as a
 * plain function of its input — no fetching, no React — so every branch can
 * be unit tested directly without a running backend. Modelled on
 * `SearchResultsSchema`'s `mainEntity`/`isPartOf` shape and its per-variant
 * availability computation (`productInStock`), and on `ProductSchema`'s use
 * of `cheapestActiveVariant` so an item's `sku` and `offers.price` always
 * describe the same variant.
 *
 * Unlike `SearchResultsSchema` — which returns `null` for an empty result so
 * a dead query never claims to have found something — a catalogue page is a
 * real, addressable collection whether or not it currently has items (an
 * empty `/products` because the API is down is still `/products`), so this
 * always renders a valid `ItemList`, empty or not, rather than omitting the
 * node or throwing.
 *
 * `about`, when given, is an `@id` reference to another node on the same
 * page this CollectionPage is unambiguously about (Task, 2026-07-31: a
 * partner's own Organization node on `/[slug]`) — otherwise three top-level
 * nodes at that URL (BreadcrumbList, Organization, CollectionPage) share the
 * page with no addressable link between them.
 */
export function buildCollectionSchema(
  name: string,
  path: string,
  items: CollectionSchemaItems,
  about?: { "@id": string },
): Record<string, unknown> {
  const url = `${BASE_URL}${path}`;

  const itemListElement =
    items.kind === "products"
      ? items.products.map((product, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: productListItem(product),
        }))
      : items.brands.map((brand, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Brand",
            name: brand.name,
            url: brand.url,
            ...(brand.imageUrl ? { image: brand.imageUrl } : {}),
            ...(brand.description ? { description: brand.description } : {}),
          },
        }));

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url,
    name,
    isPartOf: { "@id": `${BASE_URL}/#website` },
    ...(about ? { about } : {}),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemListElement.length,
      itemListElement,
    },
  };
}

export default function CollectionSchema({ name, path, items, about }: CollectionSchemaProps) {
  const schema = buildCollectionSchema(name, path, items, about);
  return <JsonLd data={schema} />;
}

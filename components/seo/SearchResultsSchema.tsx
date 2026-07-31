import { JsonLd } from "./JsonLd";
import type { ApiProduct } from "@/lib/api/catalog";
import { productListItem } from "./CollectionSchema";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

interface SearchResultsSchemaProps {
  query: string;
  products: ApiProduct[];
}

/**
 * SearchResultsPage + an ItemList of what the page actually returned.
 *
 * This is the half of on-site search SEO that the WebSite/SearchAction node in
 * OrganizationSchema cannot do on its own. SearchAction tells Google the query
 * URL shape exists; this tells it what a given query URL *contains*, so a
 * "minirue <product>" query has real, typed product data attached to the exact
 * URL that answers it, rather than an untyped wall of markup.
 *
 * Only the first page of server-rendered results is described. Whatever the
 * shopper loads afterwards via "Load more" is not in the HTML a crawler sees,
 * and claiming items that are not on the page is exactly the mismatch that gets
 * structured data ignored.
 */
export default function SearchResultsSchema({ query, products }: SearchResultsSchemaProps) {
  if (!query.trim() || products.length === 0) return null;

  const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    url,
    name: `${query} — MiniRue`,
    isPartOf: { "@id": `${BASE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      // Delegates the per-product ListItem body to the same productListItem()
      // buildCollectionSchema uses (components/seo/CollectionSchema.tsx) — the
      // two used to be near-verbatim copies that had already drifted (this
      // one omitted `sku`), and a shared function is the only way that can't
      // happen again.
      itemListElement: products.map((product, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: productListItem(product),
      })),
    },
  };

  return <JsonLd data={schema} />;
}

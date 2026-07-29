import { JsonLd } from "./JsonLd";
import type { ApiProduct } from "@/lib/api/catalog";
import { lowestPrice, productBrand } from "@/lib/api/catalog";

const BASE_URL = "https://minirueshop.com";

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
      itemListElement: products.map((product, i) => {
        const price = lowestPrice(product);
        const brand = productBrand(product);
        return {
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: product.name,
            url: `${BASE_URL}/products/${product.slug}`,
            ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
            ...(price
              ? {
                  offers: {
                    "@type": "Offer",
                    // priceAmount is a Dinero string and is emitted as-is —
                    // parsing it to a float here would round money for SEO.
                    price: price.amount,
                    priceCurrency: price.currency,
                    url: `${BASE_URL}/products/${product.slug}`,
                  },
                }
              : {}),
          },
        };
      }),
    },
  };

  return <JsonLd data={schema} />;
}

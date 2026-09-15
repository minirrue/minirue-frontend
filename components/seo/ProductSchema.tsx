import { JsonLd } from "./JsonLd";
import type { ApiProduct } from "@/lib/api/catalog";
import {
  cheapestActiveVariant,
  lowestPrice,
  productBrand,
  productInStock,
} from "@/lib/api/catalog";
import { productImageUrls, productSeoDescription } from "@/lib/seo/product-seo";
import type { PublicReview } from "@/lib/api/reviews";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";
import { productPath } from '@/lib/routes';

interface ProductSchemaProps {
  slug: string;
  productName?: string;
  apiProductJson: string;
  /** Real reviews for this product, fetched server-side (see
   * app/products/[slug]/product-data.ts). Omitted or empty simply omits
   * `review` from the schema — never fabricated. */
  reviews?: PublicReview[];
}

/**
 * Builds the Product JSON-LD node from real API data only. Kept as a plain
 * function of its inputs (no fetching, no React) so it can be unit tested
 * directly without rendering the component or a running backend.
 */
export function buildProductSchema(
  p: ApiProduct,
  reviews: PublicReview[] = [],
): Record<string, unknown> {
  const price = lowestPrice(p);
  // Every gallery image, cover first. Google recommends several images for a
  // Product, and `image` as an array is what its Product rich result reads.
  const images = productImageUrls(p);
  // The SKU of the variant the offer actually describes — never the product id.
  const offerVariant = cheapestActiveVariant(p);
  const hasRating =
    typeof p.reviewsCount === "number" && p.reviewsCount > 0 && p.reviewsAverage != null;

/**
 * The canonical product URL, and it must be the one that ACTUALLY serves the
 * page.
 *
 * Structured data is a claim made to a search engine about identity, so
 * pointing it at `/products/{slug}` — a permanent redirect since the routes
 * moved under /shop — told Google the canonical address of every product was
 * a URL that immediately forwards somewhere else. That splits the signal
 * between two addresses and makes the @id disagree with the page's own
 * canonical tag, which is the one thing an @id exists to pin down.
 */
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE_URL}${productPath(p)}#product`,
    name: p.name,
    // The product's own copy. The meta-description sentence is only a
    // fallback, so a product with no description still validates.
    description: p.description || productSeoDescription(p),
    ...(offerVariant?.sku ? { sku: offerVariant.sku } : {}),
    ...(productBrand(p)
      ? { brand: { "@type": "Brand", name: productBrand(p) } }
      : {}),
    ...(images.length ? { image: images } : {}),
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.reviewsAverage,
            reviewCount: p.reviewsCount,
          },
        }
      : {}),
    ...(reviews.length
      ? {
          review: reviews.map((r) => ({
            "@type": "Review",
            ...(r.title ? { name: r.title } : {}),
            ...(r.body ? { reviewBody: r.body } : {}),
            reviewRating: { "@type": "Rating", ratingValue: r.rating },
            author: { "@type": "Person", name: r.reviewerName },
            datePublished: r.createdAt,
          })),
        }
      : {}),
    offers: price
      ? {
          "@type": "Offer",
          priceCurrency: price.currency,
          price: price.amount,
          availability: productInStock(p)
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          // MiniRue sells only new, sealed stock.
          itemCondition: "https://schema.org/NewCondition",
          url: `${BASE_URL}${productPath(p)}`,
        }
      : undefined,
  };

  return schema;
}

export default function ProductSchema({ apiProductJson, reviews }: ProductSchemaProps) {
  const p = JSON.parse(apiProductJson) as ApiProduct;
  const schema = buildProductSchema(p, reviews);

  return <JsonLd data={schema} />;
}

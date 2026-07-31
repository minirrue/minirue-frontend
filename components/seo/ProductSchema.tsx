import { JsonLd } from "./JsonLd";
import type { ApiProduct } from "@/lib/api/catalog";
import {
  cheapestActiveVariant,
  mediaImageUrl,
  lowestPrice,
  primaryMedia,
  productBrand,
  productInStock,
} from "@/lib/api/catalog";
import type { PublicReview } from "@/lib/api/reviews";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

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
  const media = primaryMedia(p);
  const price = lowestPrice(p);
  const imgUrl = media ? mediaImageUrl(media, { w: 800, h: 1000 }) ?? undefined : undefined;
  // The SKU of the variant the offer actually describes — never the product id.
  const offerVariant = cheapestActiveVariant(p);
  const hasRating =
    typeof p.reviewsCount === "number" && p.reviewsCount > 0 && p.reviewsAverage != null;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE_URL}/products/${p.slug}#product`,
    name: p.name,
    description: p.description,
    ...(offerVariant?.sku ? { sku: offerVariant.sku } : {}),
    ...(productBrand(p)
      ? { brand: { "@type": "Brand", name: productBrand(p) } }
      : {}),
    ...(imgUrl ? { image: imgUrl } : {}),
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
          url: `${BASE_URL}/products/${p.slug}`,
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

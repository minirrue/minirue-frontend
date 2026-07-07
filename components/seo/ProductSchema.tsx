import { JsonLd } from "./JsonLd";
import type { ApiProduct } from "@/lib/api/catalog";
import { primaryMedia, cloudinaryUrl, lowestPrice } from "@/lib/api/catalog";

const BASE_URL = "https://minirueshop.com";

interface ProductSchemaProps {
  slug: string;
  productName?: string;
  apiProductJson: string;
}

export default function ProductSchema({ slug, apiProductJson }: ProductSchemaProps) {
  const p = JSON.parse(apiProductJson) as ApiProduct;
  const media = primaryMedia(p);
  const price = lowestPrice(p);
  const imgUrl = media ? cloudinaryUrl(media.cloudinaryPublicId, { w: 800, h: 1000 }) : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE_URL}/products/${p.slug}#product`,
    name: p.name,
    description: p.tagline ?? p.description,
    sku: p.id,
    brand: { "@type": "Brand", name: p.brand },
    ...(imgUrl ? { image: imgUrl } : {}),
    offers: price
      ? {
          "@type": "Offer",
          priceCurrency: price.currency,
          price: price.amount,
          availability: "https://schema.org/InStock",
          url: `${BASE_URL}/products/${p.slug}`,
        }
      : undefined,
  };

  return <JsonLd data={schema} />;
}

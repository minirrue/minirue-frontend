import type { ApiProduct } from '@/lib/api/catalog';
import { primaryMedia, cloudinaryUrl, lowestPrice } from '@/lib/api/catalog';

interface ProductSchemaProps {
  slug: string;
  productName?: string;
  apiProductJson: string;
}

export default function ProductSchema({ slug, productName, apiProductJson }: ProductSchemaProps) {
  const p = JSON.parse(apiProductJson) as ApiProduct;
  const media = primaryMedia(p);
  const price = lowestPrice(p);
  const imgUrl = media ? cloudinaryUrl(media.cloudinaryPublicId, { w: 800, h: 1000 }) : undefined;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.tagline ?? p.description,
    sku: p.id,
    brand: { '@type': 'Brand', name: p.brand },
    offers: price
      ? {
          '@type': 'Offer',
          priceCurrency: price.currency,
          price: price.amount,
          availability: 'https://schema.org/InStock',
          url: `https://minirue.com/products/${p.slug}`,
        }
      : undefined,
    ...(imgUrl ? { image: imgUrl } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

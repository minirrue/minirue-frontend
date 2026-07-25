'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { ApiProduct, ProductVariant } from '@/lib/api/catalog';
import { primaryMedia, mediaImageUrl, productBrand, variantLabel } from '@/lib/api/catalog';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import { useCart } from '@/components/storefront/cart/CartContext';
import { useStorefrontChrome } from '@/lib/hooks/use-storefront';
import { FALLBACK_CHROME } from '@/lib/api/storefront';
import type { ProductSectionConfig } from '@/lib/api/storefront';
import { useSupportContext } from '@/lib/support/support-context';

interface Props {
  slug: string;
  apiProductJson: string;
  /** Resolved server-side so they render in the initial HTML. */
  perks: ProductSectionConfig['perks'];
}

export default function ProductPageClient({ slug, apiProductJson, perks }: Props) {
  const router = useRouter();
  const { itemCount, openDrawer, addItem } = useCart();
  const { data: chrome } = useStorefrontChrome();
  const { setSubject } = useSupportContext();

  const product: ApiProduct = React.useMemo(
    () => JSON.parse(apiProductJson) as ApiProduct,
    [apiProductJson],
  );

  // Auto-attach this product as the support widget's default subject so a
  // guest/customer messaging from this page doesn't have to pick it manually.
  React.useEffect(() => {
    setSubject({ productId: product.id, subjectSnapshot: { name: product.name, slug } });
    return () => setSubject(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, product.name, slug]);

  const handleAddToBag = async (variant: ProductVariant) => {
    const media = primaryMedia(product);
    await addItem(variant.id, 1, {
      name: product.name,
      brand: productBrand(product) ?? undefined,
      sizeMl: variant.sizeMl ?? undefined,
      // Attribute-based variants have no bottleType column — carry the resolved
      // attribute label so the cart row still shows what was picked.
      bottleType: variant.bottleType ?? variantLabel(variant),
      cloudinaryPublicId: media?.cloudinaryPublicId,
      imageUrl: media ? mediaImageUrl(media, { w: 160, h: 200 }) ?? undefined : undefined,
      altText: media?.altText,
    });
    openDrawer();
  };

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <Header
          navbar={chrome?.navbar ?? FALLBACK_CHROME.navbar}
          onOpenCart={openDrawer}
          cartCount={itemCount}
          transparent={false}
        />
        <ApiProductDetail
          product={product}
          perks={perks}
          onBack={() => router.push('/products')}
          onAddToBag={handleAddToBag}
        />
      </div>
    </>
  );
}

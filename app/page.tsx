import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import HomePageClient from './HomePageClient';
import { catalog } from '@/lib/api/catalog';
import { apiGetPublicSettings } from '@/lib/api/settings';
import { apiListPublicBrands, type CollaboratorBrandSection } from '@/lib/api/collaborators';
import { getQueryClient } from '@/lib/hooks/query-client';
import { productsQueryOptions } from '@/lib/hooks/queries';
import type { ApiProduct } from '@/lib/api/catalog';
import type { PublicSettings } from '@/lib/api/settings';

export default async function HomePage() {
  const queryClient = getQueryClient();

  // Non‑blocking prefetch so TanStack Query has data ready for client‑side hooks
  void queryClient.prefetchQuery(productsQueryOptions({ limit: 8 }));

  let products: ApiProduct[] = [];
  let publicSettings: PublicSettings | null = null;
  let brandSections: CollaboratorBrandSection[] = [];
  try {
    const result = await catalog.listProducts({ limit: 8 });
    products = result.data;
  } catch {
    // backend unavailable — show empty grids
  }
  try {
    publicSettings = await apiGetPublicSettings();
  } catch {
    // use component fallbacks
  }
  try {
    const brands = await apiListPublicBrands();
    const featured = brands.filter((b) => b.storefrontHomeFeature);
    brandSections = await Promise.all(
      featured.map(async (brand) => {
        try {
          const res = await catalog.listProducts({ brand: brand.brandName, limit: 4 });
          return { ...brand, products: res.data };
        } catch {
          return { ...brand, products: [] };
        }
      }),
    );
  } catch {
    // no collaborator section
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePageClient
        products={products}
        publicSettings={publicSettings}
        brandSections={brandSections}
      />
    </HydrationBoundary>
  );
}

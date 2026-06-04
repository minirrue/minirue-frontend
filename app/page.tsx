import HomePageClient from './HomePageClient';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';

export default async function HomePage() {
  let products: ApiProduct[] = [];
  try {
    const result = await catalog.listProducts({ limit: 8 });
    products = result.data;
  } catch {
    // backend unavailable — show empty grids
  }
  return <HomePageClient products={products} />;
}

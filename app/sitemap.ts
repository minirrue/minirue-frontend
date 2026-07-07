import type { MetadataRoute } from "next";
import { catalog } from "@/lib/api/catalog";
import { apiListPublicBrands } from "@/lib/api/collaborators";

const BASE_URL = "https://minirueshop.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/cart`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/forgot`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ];

  // Dynamic products
  try {
    const result = await catalog.listProducts({ limit: 1000 });
    for (const p of result.data) {
      entries.push({
        url: `${BASE_URL}/products/${p.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // backend unavailable — skip dynamic product entries
  }

  // Dynamic categories
  try {
    const categories = await catalog.listCategories();
    for (const cat of categories) {
      entries.push({
        url: `${BASE_URL}/categories/${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    // skip
  }

  // Dynamic brands
  try {
    const brands = await apiListPublicBrands();
    for (const brand of brands) {
      entries.push({
        url: `${BASE_URL}/brands/${brand.brandSlug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // skip
  }

  return entries;
}

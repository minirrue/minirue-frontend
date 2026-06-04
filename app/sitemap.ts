import type { MetadataRoute } from "next";
import { catalog } from "@/lib/api/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const result = await catalog.listProducts({ limit: 1000 });
    productEntries = result.data.map((p) => ({
      url: `https://minirue.com/products/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch {
    // backend unavailable — return minimal sitemap
  }

  return [
    {
      url: "https://minirue.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...productEntries,
  ];
}

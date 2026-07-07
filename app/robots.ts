import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/signup", "/forgot", "/api/", "/checkout"],
    },
    sitemap: "https://minirueshop.com/sitemap.xml",
  };
}

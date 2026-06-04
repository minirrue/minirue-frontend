import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/signup", "/forgot"],
    },
    sitemap: "https://minirue.com/sitemap.xml",
  };
}

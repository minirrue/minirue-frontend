import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/signup",
        "/forgot",
        "/reset-password",
        "/api/",
        "/checkout",
        "/cart",
        "/_internal/preview",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

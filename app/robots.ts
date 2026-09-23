import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/config";

/** Pages no crawler should index: account, checkout, API and internal preview. */
const DISALLOW = [
  "/login",
  "/signup",
  "/forgot",
  "/reset-password",
  "/api/",
  "/checkout",
  "/cart",
  "/_internal/preview",
  // The dashboard editor's draft preview (#193): framed by the dashboard only.
  "/_internal/draft-preview",
];

/**
 * AI crawlers and assistants, named explicitly (#150).
 *
 * `*` already allows them. The named groups make the policy unambiguous. A
 * crawler obeys ONLY the most specific group that matches it, so each group
 * repeats the full disallow list: without it GPTBot could crawl /checkout.
 *
 * The shop's plain-text catalog for these agents is /llms.txt (and
 * /llms-full.txt). Next's robots API cannot emit comments, so the file is
 * linked from here in source only; it is discoverable at its standard path.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

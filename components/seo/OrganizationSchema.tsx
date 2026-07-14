import { JsonLd } from "./JsonLd";

const BASE_URL = "https://minirueshop.com";

/**
 * Brand-name variants. This is the actual mechanism that teaches Google that "Mini Rue",
 * "Mini Rue Shop" and "MiniRue" are ONE brand — searching "mini rue shop" surfaced nothing
 * because the entity had only ever been declared as the single token "MiniRue".
 *
 * `<meta keywords>` does NOT do this (Google has ignored it since 2009). `alternateName` on a
 * schema.org Organization/WebSite does — it is how the Knowledge Graph learns a brand's aliases.
 */
const ALTERNATE_NAMES = [
  "Mini Rue",
  "Mini Rue Shop",
  "MiniRue Shop",
  "MiniRue Perfumes",
  "Mini Rue Perfumes",
  "minirueshop",
  "minirue",
];

const organization: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "MiniRue",
  alternateName: ALTERNATE_NAMES,
  legalName: "MiniRue",
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description:
    "MiniRue (Mini Rue) — worldwide e-commerce for high-premium, original-quality perfume.",
  slogan: "Original quality perfumes",
  brand: {
    "@type": "Brand",
    name: "MiniRue",
    alternateName: ALTERNATE_NAMES,
    logo: `${BASE_URL}/logo.png`,
  },
  sameAs: [
    "https://facebook.com/minirue",
    "https://instagram.com/minirue",
    "https://tiktok.com/@minirue",
  ],
};

/**
 * WebSite + SearchAction. Two jobs:
 *  - carries the same brand aliases at the SITE level, not just the organization level
 *  - declares the real on-site search endpoint (/search?q=), which is what makes the site eligible
 *    for a sitelinks searchbox under the brand result. `/search` is a real, shipped route.
 */
const website: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "MiniRue",
  alternateName: ALTERNATE_NAMES,
  url: BASE_URL,
  publisher: { "@id": `${BASE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function OrganizationSchema() {
  return (
    <>
      <JsonLd data={organization} />
      <JsonLd data={website} />
    </>
  );
}

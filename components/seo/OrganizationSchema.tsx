import { JsonLd } from "./JsonLd";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

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
  "Mini Rue Store",
  "MiniRue Store",
  "Mini Rue Perfumes",
  "MiniRue Perfumes",
  "minirueshop",
  "minirue",
];

const organization: Record<string, unknown> = {
  "@context": "https://schema.org",
  // OnlineStore in addition to Organization: this is a storefront, and the
  // extra type is accurate and low-risk (Google ignores types it doesn't use
  // for a given rich result, it doesn't penalise extras).
  "@type": ["Organization", "OnlineStore"],
  "@id": `${BASE_URL}/#organization`,
  name: "MiniRue",
  alternateName: ALTERNATE_NAMES,
  legalName: "MiniRue",
  url: BASE_URL,
  // Now a real, shipped file — see public/logo.png (generated from
  // public/assets/logo-on-dark.png). `logo` is required for Organization to
  // validate at all; it was pointing at a 404 before this.
  logo: `${BASE_URL}/logo.png`,
  description:
    "MiniRue (Mini Rue) — worldwide e-commerce for high-premium, original-quality perfume.",
  slogan: "Original quality perfumes",
  // Broad, not a country list: the site's own copy (app/layout.tsx) only ever
  // claims "Free worldwide shipping" and "duty-paid to 62 countries" — it
  // never names which 62. lib/auth/dial-codes.ts is a curated ~49-country
  // phone-signup select ("deliberately not the full ISO list", per its own
  // comment), not a shipping-destination list, so treating it as one here
  // would be inventing structured data the site doesn't actually assert.
  // "Worldwide" is the literal claim already on every page.
  areaServed: "Worldwide",
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
  // Deliberately NOT included: address, contactPoint, telephone, email,
  // vatID, foundingDate. A repo-wide search found no sourceable business
  // address, support email, phone number, or founding date — only auth test
  // fixtures and the Egypt dial-code table above. PRODUCT.md documents that
  // MiniRue is Cairo-fulfilled/EGP-priced but is *presented* as an
  // international "Maison Paris"-style atelier; publishing a Cairo postal
  // address here is a brand-positioning decision for the business to make,
  // not something to infer. A wrong or premature address in this node is
  // exactly the signal Google uses to build a knowledge panel and match a
  // Business Profile, so it's safer omitted than guessed.
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

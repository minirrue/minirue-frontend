import { JsonLd } from "./JsonLd";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

export interface Crumb {
  name: string;
  path: string;
}

/** Every trail starts here — never supplied by a caller. */
const HOME_CRUMB: Crumb = { name: "Home", path: "" };

/**
 * The shop's top-level section crumb. Until Task 9 this was the ONLY crumb
 * `BreadcrumbSchema` could express (hardcoded as `SECTION`), which made it
 * structurally incapable of a partner space's `Home / {space} / {child}`
 * trail. Kept here as a named constant, not folded away, because the three
 * catalogue call sites (`/products`, `/products/[slug]`, `/categories/[slug]`)
 * still want exactly this crumb and shouldn't each redeclare it.
 *
 * Was hardcoded to "Perfumes" until Task 19 (2026-07-30); MiniRue sells more
 * than perfume and a category literally named that read as a duplicate.
 */
export const SHOP_CRUMB: Crumb = { name: "Shop", path: "products" };

/**
 * Builds a BreadcrumbList from Home plus an arbitrary caller-supplied trail,
 * root-first. Pure function of its input — no fetching, no React — so it's
 * unit-testable directly, the same approach `buildCollectionSchema` uses.
 */
export function buildBreadcrumbSchema(trail: Crumb[]): Record<string, unknown> {
  const crumbs = [HOME_CRUMB, ...trail]
    // A crumb that just restates the one before it — by name or by URL — is
    // dropped: a category literally named "Shop" (or one whose own page IS
    // the "Shop" section, like /products itself), or (on a space page) a
    // child whose slug happens to equal its space's.
    .filter((crumb, i, all) => {
      const prev = all[i - 1];
      if (!prev) return true;
      return (
        crumb.name.trim().toLowerCase() !== prev.name.trim().toLowerCase() &&
        crumb.path !== prev.path
      );
    });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.path ? `${BASE_URL}/${crumb.path}` : BASE_URL,
    })),
  };
}

interface BreadcrumbSchemaProps {
  /** Root-first trail after Home — Home is always prepended automatically. */
  trail: Crumb[];
}

export default function BreadcrumbSchema({ trail }: BreadcrumbSchemaProps) {
  return <JsonLd data={buildBreadcrumbSchema(trail)} />;
}

import { JsonLd } from "./JsonLd";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

/** The section every catalogue page sits under — the shop, not a category.
 * Was hardcoded to "Perfumes" until Task 19 (2026-07-30); MiniRue sells more
 * than perfume and a category literally named that read as a duplicate. */
const SECTION = { name: "Shop", path: "products" };

interface Crumb {
  name: string;
  path: string;
}

interface BreadcrumbSchemaProps {
  productName: string;
  productSlug: string;
  /**
   * Ancestor crumbs between "Shop" and the final crumb, root-first — a
   * category's own parent chain, e.g. `[{ name: 'Jewellery', path:
   * 'categories/jewellery' }]` for a nested "Rings" category. Empty for a
   * top-level page.
   */
  ancestors?: Crumb[];
}

export default function BreadcrumbSchema({
  productName,
  productSlug,
  ancestors = [],
}: BreadcrumbSchemaProps) {
  const trail = [
    { name: "Home", path: "" },
    SECTION,
    ...ancestors,
    { name: productName, path: productSlug },
  ]
    // A category literally named "Shop" (or one whose own page IS the "Shop"
    // section, like /products itself) repeated the section crumb. Drop a
    // crumb that just restates the one before it, by name or by URL.
    .filter((crumb, i, all) => {
      const prev = all[i - 1];
      if (!prev) return true;
      return (
        crumb.name.trim().toLowerCase() !== prev.name.trim().toLowerCase() &&
        crumb.path !== prev.path
      );
    });

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.path ? `${BASE_URL}/${crumb.path}` : BASE_URL,
    })),
  };

  return <JsonLd data={schema} />;
}

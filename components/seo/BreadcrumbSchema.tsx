import { JsonLd } from "./JsonLd";

const BASE_URL = "https://minirueshop.com";

/** The section every catalogue page sits under. */
const SECTION = { name: "Perfumes", path: "products" };

interface BreadcrumbSchemaProps {
  productName: string;
  productSlug: string;
}

export default function BreadcrumbSchema({ productName, productSlug }: BreadcrumbSchemaProps) {
  const trail = [
    { name: "Home", path: "" },
    SECTION,
    { name: productName, path: productSlug },
  ]
    // A category literally named "Perfumes" repeated the section crumb, so the
    // page (and the JSON-LD Google reads) said Home / Perfumes / Perfumes. Drop a
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

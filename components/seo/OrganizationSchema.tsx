import { JsonLd } from "./JsonLd";

const BASE_URL = "https://minirueshop.com";

const schema: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "MiniRue",
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description: "Worldwide e-commerce for high-premium, original-quality perfume.",
  sameAs: [
    "https://facebook.com/minirue",
    "https://instagram.com/minirue",
    "https://tiktok.com/@minirue",
  ],
};

export default function OrganizationSchema() {
  return <JsonLd data={schema} />;
}

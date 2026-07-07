import { JsonLd } from "./JsonLd";

const BASE_URL = "https://minirueshop.com";

interface BreadcrumbSchemaProps {
  productName: string;
  productSlug: string;
}

export default function BreadcrumbSchema({ productName, productSlug }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Perfume",
        item: `${BASE_URL}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: productName,
        item: `${BASE_URL}/${productSlug}`,
      },
    ],
  };

  return <JsonLd data={schema} />;
}

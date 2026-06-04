interface BreadcrumbSchemaProps {
  productName: string;
  productSlug: string;
}

export default function BreadcrumbSchema({ productName, productSlug }: BreadcrumbSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://minirue.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Perfume',
        item: 'https://minirue.com/products',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: productName,
        item: `https://minirue.com/products/${productSlug}`,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

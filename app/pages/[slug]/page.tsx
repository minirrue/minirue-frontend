import { permanentRedirect } from 'next/navigation';

/**
 * Legacy route. Storefront pages are canonically served at /<slug> now (see
 * app/[slug]/page.tsx); this keeps every /pages/<slug> link ever shared — or
 * indexed — working by sending it to the canonical URL.
 */
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyConstantPage({ params }: PageProps) {
  const { slug } = await params;
  permanentRedirect(`/${slug}`);
}

import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/shop/HeaderWrapper';
import { getBundle, type Bundle } from '@/lib/api/bundles';
import BundleDetail from './BundleDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const bundle = await getBundle(slug);
    return {
      title: `${bundle.name} — MiniRue`,
      description:
        bundle.description ??
        `${bundle.members.length} pieces, priced as one set.`,
      alternates: { canonical: `/bundles/${bundle.slug}` },
    };
  } catch {
    // A set that has been retired should not carry a title claiming it exists.
    return { title: 'Bundle — MiniRue' };
  }
}

export default async function BundlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;

  let bundle: Bundle;
  try {
    bundle = await getBundle(slug);
  } catch {
    // Retired, hidden, or never existed — all the same to a shopper, and all a
    // 404 rather than an error page.
    notFound();
  }

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBarServer />
        <HeaderWrapper />
        <BundleDetail bundle={bundle} />
      </div>

      {/* The footer band — AFTER the page sheet, which is where it was before
          September and where the DOM should read it: the page first, its
          footer last. It is ordered UNDER the page by `z-index: -1` resolved
          inside `.mr-app-layer` (app/layout.tsx), not by being moved ahead of
          the page in document order the way #48 did. See
          components/layout/Footer.tsx. */}
      <FooterWithSettings />
    </>
  );
}

import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/shop/HeaderWrapper';
import StorefrontPageArticle from '@/components/storefront/StorefrontPageArticle';

/**
 * Renders one admin-authored storefront page (Terms, Privacy, …). Shared by the
 * canonical `/<slug>` route and the legacy `/pages/<slug>` one so both render
 * identically while old links keep working.
 */
export default function StorefrontPageView({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBarServer />
        <HeaderWrapper />

        <StorefrontPageArticle title={title} body={body} />
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

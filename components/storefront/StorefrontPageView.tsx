import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/shop/HeaderWrapper';
import Markdown from '@/components/storefront/Markdown';

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

        <main
          style={{
            maxWidth: 'var(--mr-content-max)',
            margin: '0 auto',
            padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
          }}
        >
          <article>
            <h1
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontWeight: 400,
                fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
                lineHeight: 1.08,
                letterSpacing: '-0.006em',
                margin: '0 0 clamp(28px, 5vw, 44px)',
                color: 'var(--mr-fg)',
                textAlign: 'center',
              }}
            >
              {title}
            </h1>
            <Markdown body={body} />
          </article>
        </main>
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

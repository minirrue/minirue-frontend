import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
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
    <div className="mr-page-sheet">
      <AnnouncementBar />
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

      <FooterWithSettings />
    </div>
  );
}

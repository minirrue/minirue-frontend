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
      {/* The curtain, BEFORE the sheet on purpose, and this is the canonical
          copy of the reason the other call sites point at.

          Both boxes are positioned and both are `z-index: auto`, so they paint
          in DOCUMENT ORDER: the later sibling wins. The sheet has to be the
          later sibling, or the footer paints over the page instead of being
          revealed from under it — which is exactly what shipped twice (see
          components/layout/Footer.tsx for the three measured failures). No
          z-index settles this, deliberately: giving either box one creates a
          stacking context and seals every overlay inside it. */}
      <FooterWithSettings />

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
    </>
  );
}

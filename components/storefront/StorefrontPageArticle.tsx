import Markdown from '@/components/storefront/Markdown';

/**
 * The body of one admin-authored storefront page (Terms, Privacy, …): the
 * centred serif title and the Markdown text.
 *
 * Split out of `StorefrontPageView` (#193) so the dashboard's draft preview
 * can render the SAME page body the live `/<slug>` route renders.
 * `StorefrontPageView` is a server component whose chrome fetches on the
 * server, so a client preview cannot import it; this part has no data
 * dependency and works on both sides.
 */
export default function StorefrontPageArticle({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
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
  );
}

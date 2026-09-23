'use client';

/**
 * The dashboard editor's live preview of the owner's UNSAVED storefront (#193).
 *
 * The data path keeps admin credentials off this origin entirely: the
 * dashboard posts the draft to the backend with its own session
 * (`POST /v1/storefront/preview`), then hands the resolved `{ home, chrome }`
 * to this frame with `postMessage`. This page renders it with the live shop's
 * own components — `HomePageClient` is literally what `/` renders — fed
 * through `StorefrontPreviewProvider` instead of the network.
 *
 * The protocol (exact strings, lib/preview/protocol.ts):
 *   → parent  mr-preview:ready · mr-preview:height · mr-preview:select
 *   ← parent  mr-preview:render { home, chrome, view, page?, productSlug?, highlight? }
 *   ← parent  mr-preview:mode { interactive }   → parent  mr-preview:navigate { href }
 * Messages are accepted ONLY from the dashboard origins
 * (lib/preview/dashboard-origins.ts) — the same list the route's CSP
 * `frame-ancestors` is built from.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import HomePageClient from '@/app/HomePageClient';
import HeaderWrapper from '@/app/shop/HeaderWrapper';
import ProductPageClient from '@/app/shop/[category]/[product]/ProductPageClient';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import StorefrontPageArticle from '@/components/storefront/StorefrontPageArticle';
import { catalog } from '@/lib/api/catalog';
import { FALLBACK_CHROME, type ResolvedChrome } from '@/lib/api/storefront';
import { StorefrontPreviewProvider } from '@/lib/hooks/storefront-preview';
import { closeMobileMenu, openMobileMenu } from '@/lib/hooks/useMobileChrome';
import { dashboardOrigins } from '@/lib/preview/dashboard-origins';
import {
  PREVIEW_HEIGHT,
  PREVIEW_NAVIGATE,
  PREVIEW_READY,
  PREVIEW_SELECT,
  isAllowedOrigin,
  parseModeMessage,
  parseRenderMessage,
  type PreviewPage,
  type PreviewRenderMessage,
} from '@/lib/preview/protocol';

/** The editor's gold, as the brief pins it. */
const HIGHLIGHT_COLOR = '#B0924F';

/**
 * A real tablet or phone draws no classic scrollbar; the frame at 820/390px
 * would (#196). Scoped to this route, so the live shop is untouched.
 */
const PREVIEW_CSS = `@media (max-width: 1023px) {
  html, body, * { scrollbar-width: none; }
  *::-webkit-scrollbar { display: none; }
}`;

function isFramed(): boolean {
  return typeof window !== 'undefined' && window.parent !== window;
}

/**
 * The origin that framed us, when it is an allowed one — so height and
 * selection can go out before the first render message names it.
 * `ancestorOrigins` where the browser has it; otherwise the referrer, which
 * the site's `strict-origin-when-cross-origin` policy reduces to exactly the
 * parent's origin.
 */
function framingOrigin(allowed: readonly string[]): string | null {
  const ancestor = window.location.ancestorOrigins?.[0];
  if (ancestor && isAllowedOrigin(ancestor, allowed)) return ancestor;
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : null;
    if (ref && isAllowedOrigin(ref, allowed)) return ref;
  } catch {
    // An unparseable referrer is no origin.
  }
  return null;
}

export default function DraftPreviewClient() {
  const allowed = React.useMemo(() => dashboardOrigins(), []);
  const parentOrigin = React.useRef<string | null>(null);
  const [message, setMessage] = React.useState<PreviewRenderMessage | null>(null);
  // Interact mode (#196): the shop's own clicks and keys run; nothing selects.
  const [interactive, setInteractive] = React.useState(false);
  const interactiveRef = React.useRef(false);

  const postToParent = React.useCallback((data: object) => {
    if (!isFramed() || !parentOrigin.current) return;
    window.parent.postMessage(data, parentOrigin.current);
  }, []);

  // Listen, then announce. `ready` is the one message sent to '*': it carries
  // nothing, and the parent may not be identifiable yet.
  React.useEffect(() => {
    parentOrigin.current = framingOrigin(allowed);

    const onMessage = (event: MessageEvent) => {
      if (!isAllowedOrigin(event.origin, allowed)) return;
      if (isFramed() && event.source !== window.parent) return;
      const mode = parseModeMessage(event.data);
      if (mode) {
        interactiveRef.current = mode.interactive;
        setInteractive(mode.interactive);
        return;
      }
      const parsed = parseRenderMessage(event.data);
      if (!parsed) return;
      parentOrigin.current = event.origin;
      setMessage(parsed);
    };
    window.addEventListener('message', onMessage);
    if (isFramed()) window.parent.postMessage({ type: PREVIEW_READY }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [allowed]);

  // Height, whenever the document's changes.
  React.useEffect(() => {
    let last = -1;
    let frame = 0;
    const report = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight;
      if (height === last) return;
      last = height;
      postToParent({ type: PREVIEW_HEIGHT, height });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(report);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    schedule();
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [postToParent, message]);

  // Edit mode: clicks select, they never act. Captured on `window` so no
  // component's own handler (a link, a card's router.push, add-to-bag) ever
  // runs: the frame must not navigate away from the draft or touch the
  // owner's cart.
  //
  // Interact mode (#196): the shop's own handlers run — menus, sheets,
  // carousels, dropdowns, the keyboard. Only following a link is stopped,
  // with preventDefault alone (Next's Link skips navigation when the event is
  // already defaultPrevented, and still runs its onClick, so a sheet closes
  // as it would live). The href goes to the editor, which decides what to
  // show. Forms stay blocked in both modes: a submit would leave the draft.
  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (interactiveRef.current) {
        const link = target?.closest('a[href]');
        const href = link?.getAttribute('href');
        if (link && href && !href.startsWith('#')) {
          event.preventDefault();
          postToParent({ type: PREVIEW_NAVIGATE, href });
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const block = target?.closest('[data-preview-id]');
      const id = block?.getAttribute('data-preview-id');
      if (id) postToParent({ type: PREVIEW_SELECT, target: id });
    };
    const block = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('auxclick', block, true);
    window.addEventListener('submit', block, true);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('auxclick', block, true);
      window.removeEventListener('submit', block, true);
    };
  }, [postToParent]);

  // The phone menu is the shared sheet Header already renders; open it for
  // the menu view, exactly as the hamburger would.
  const view = message?.view;
  React.useEffect(() => {
    if (!view) return;
    if (view === 'menu') openMobileMenu();
    else closeMobileMenu();
  }, [view]);

  const data = React.useMemo(
    () => (message ? { home: message.home, chrome: message.chrome } : null),
    [message],
  );

  if (!message || !data) {
    return (
      <>
      <style>{PREVIEW_CSS}</style>
      <div
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--mr-fg-muted, #6b6b6b)',
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 13,
          letterSpacing: '0.04em',
        }}
      >
        Waiting for the editor…
      </div>
      </>
    );
  }

  return (
    <StorefrontPreviewProvider value={data}>
      <style>{PREVIEW_CSS}</style>
      {message.view === 'product' && message.productSlug ? (
        <ProductPreview slug={message.productSlug} chrome={message.chrome} />
      ) : message.view === 'page' && message.page ? (
        <PagePreview page={message.page} chrome={message.chrome} />
      ) : (
        // 'home' and 'menu': the home page, with the sheet open for 'menu'.
        <HomePageClient />
      )}
      <Highlight target={interactive ? undefined : message.highlight} />
    </StorefrontPreviewProvider>
  );
}

function DraftAnnouncementBar({ chrome }: { chrome: ResolvedChrome }) {
  return (
    <AnnouncementBar
      messages={chrome.announcement.messages}
      enabled={chrome.announcement.enabled}
      linkUrl={chrome.announcement.linkUrl}
      background={chrome.announcement.background}
    />
  );
}

/**
 * The live `/<slug>` page (StorefrontPageView), with the draft's title, body
 * and chrome. The footer follows the page sheet, as on every live route
 * (__tests__/layout/footer.test.tsx).
 */
function PagePreview({ page, chrome }: { page: PreviewPage; chrome: ResolvedChrome }) {
  return (
    <>
      <div className="mr-page-sheet">
        <DraftAnnouncementBar chrome={chrome} />
        <HeaderWrapper />
        <StorefrontPageArticle title={page.title} body={page.body} />
      </div>
      <Footer config={chrome.footer} shopName={chrome.shopName} />
    </>
  );
}

/**
 * The live product page's client half, as `/shop/[category]/[product]` mounts
 * it, with the draft's chrome standing in for what that route reads on the
 * server: the promise rows (`productSection.perks`), the announcement bar and
 * the footer. The product itself is public catalog data, fetched here the way
 * the live route fetches it.
 */
function ProductPreview({ slug, chrome }: { slug: string; chrome: ResolvedChrome }) {
  const product = useQuery({
    queryKey: ['draft-preview', 'product', slug],
    queryFn: () => catalog.getProductBySlug(slug),
    staleTime: 60_000,
  });

  if (product.isPending) return <Quiet>Loading the product…</Quiet>;
  if (product.isError) return <Quiet>No product “{slug}”.</Quiet>;

  return (
    <>
      <ProductPageClient
        key={slug}
        slug={slug}
        apiProductJson={JSON.stringify(product.data)}
        perks={chrome.productSection?.perks ?? FALLBACK_CHROME.productSection.perks}
        announcement={<DraftAnnouncementBar chrome={chrome} />}
      />
      <Footer config={chrome.footer} shopName={chrome.shopName} />
    </>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--mr-fg-muted, #6b6b6b)',
        fontFamily: 'var(--mr-font-ui)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The editor's outline around the block being edited: 2px gold, inset.
 *
 * Drawn as a separate fixed overlay tracking the block's box rather than as
 * CSS on the block itself: the blocks are the live components, several are
 * sticky or carry their own pseudo-elements and stacking contexts, and an
 * outline or `::after` added to them could either be painted under their
 * children or collide with what they already draw (frontend#186).
 */
function Highlight({ target }: { target?: string }) {
  const [box, setBox] = React.useState<DOMRect | null>(null);
  const scrolledFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!target) {
      scrolledFor.current = null;
      return;
    }
    let frame = 0;
    // `navbar` tags both the bar and the phone menu sheet. Prefer the LAST
    // match on screen (the open sheet sits above the bar; a closed sheet is
    // parked below the viewport), else the first match, so an off-screen
    // block such as the footer can still be scrolled to.
    const find = (): HTMLElement | null => {
      const all = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-preview-id="${CSS.escape(target)}"]`),
      );
      const onScreen = all.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      });
      return onScreen.at(-1) ?? all[0] ?? null;
    };
    const track = () => {
      const el = find();
      const rect = el?.getBoundingClientRect() ?? null;
      setBox((prev) =>
        prev &&
        rect &&
        prev.top === rect.top &&
        prev.left === rect.left &&
        prev.width === rect.width &&
        prev.height === rect.height
          ? prev
          : rect,
      );
      // Scroll once per newly selected block, not on every render message —
      // the owner is typing into that block and the page must hold still.
      if (el && scrolledFor.current !== target) {
        scrolledFor.current = target;
        el.scrollIntoView({
          block: el.offsetHeight > window.innerHeight ? 'start' : 'center',
          behavior: 'smooth',
        });
      }
      frame = window.requestAnimationFrame(track);
    };
    track();
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  if (!target || !box || box.width === 0 || box.height === 0) return null;
  // Portalled to <body> so no transformed ancestor can re-anchor `fixed`.
  return createPortal(
    <div
      aria-hidden="true"
      data-preview-highlight={target}
      style={{
        position: 'fixed',
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        boxSizing: 'border-box',
        border: `2px solid ${HIGHLIGHT_COLOR}`,
        pointerEvents: 'none',
        zIndex: 2147483647,
      }}
    />,
    document.body,
  );
}

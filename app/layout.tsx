import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, Jost, Inter_Tight } from "next/font/google";
import "./globals.css";
import LenisProvider from "@/components/providers/LenisProvider";
import OrganizationSchema from "@/components/seo/OrganizationSchema";
import { CartProvider } from "@/components/storefront/cart/CartContext";
import { SitewideDiscountProvider } from "@/lib/hooks/use-sitewide-discount";
import CartDrawer from "@/components/storefront/cart/CartDrawer";
import { RootQueryProvider, getQueryClient } from "@/lib/hooks";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SessionExpiredHandler from "@/components/auth/SessionExpiredHandler";
import StorefrontLiveUpdates from "@/components/providers/StorefrontLiveUpdates";
import { apiGetPublicSettings } from "@/lib/api/settings";
import { SupportProvider } from "@/lib/support/support-context";
import SupportWidget from "@/components/chat/SupportWidget";
import { AnnouncementBarProvider } from "@/components/layout/AnnouncementBar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PageLoader from "@/components/layout/PageLoader";
import AnalyticsProvider from "@/components/providers/AnalyticsProvider";
import MetaPixel from "@/components/seo/MetaPixel";
import { META_PIXEL_ID, metaPixelBaseCode } from "@/lib/analytics/meta-pixel";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";
import { buildIcons } from "@/lib/seo/icons";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const viewport: Viewport = {
  // Explicit, not relying on Next's implicit default — a partial `viewport` export
  // (this one used to only set themeColor/viewportFit) does not backfill width/
  // initialScale for you. Without these two, iOS Safari has rendered pages at an
  // arbitrary zoomed-out scale on first paint and un-zooms inconsistently across
  // navigations, which read as "it zooms in and out and never settles."
  width: "device-width",
  initialScale: 1,
  // Deliberately NOT setting maximumScale/userScalable — that disables pinch-zoom,
  // which is a WCAG 1.4.4 failure and was never the actual bug (see globals.css /
  // components/ui/Input.tsx for the real cause: sub-16px form control text
  // triggering iOS's own auto-zoom-on-focus, which this does not touch).
  // Light-only storefront. A dark themeColor variant made the browser chrome (and, on a
  // dark-mode OS, the pre-paint canvas) go near-black between pages — see globals.css.
  themeColor: "#F6F2E9", // --mr-cream-200, matches body + .mr-page-sheet
  // Without this, iOS Safari never extends the layout viewport under the home
  // indicator, so every env(safe-area-inset-*) call in the app (the sticky
  // buy bar's bottom padding among them) resolves to 0px and does nothing.
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: {
      // The spaced alias is deliberate: users search "mini rue shop" and the site never surfaced,
      // because no on-page text or entity ever spelled the brand with a space. The title is the
      // strongest on-page signal, so it carries the exact queried phrase once, naturally.
      default: "MiniRue — Original Cosmetics & Perfumes | Mini Rue Shop",
      template: "%s | MiniRue (Mini Rue)",
    },
    description:
      "Discover MiniRue (Mini Rue) — original cosmetics & perfumes, in luxury packaging.",
    applicationName: "MiniRue",
    authors: [{ name: "MiniRue" }],
    // NOTE: Google has ignored <meta keywords> since 2009 — these are here for the non-Google
    // engines that still read them (Bing/Yandex weight them lightly). The real brand-alias signal
    // is `alternateName` in the Organization/WebSite JSON-LD (see components/seo/OrganizationSchema).
    keywords: [
      "MiniRue",
      "Mini Rue",
      "Mini Rue Shop",
      "MiniRue Shop",
      "Mini Rue Store",
      "MiniRue Store",
      "minirueshop",
      "perfume",
      "cosmetics",
      "fragrance",
      "niche perfume",
      "oud",
    ],
    // Search Console / Bing verification. A brand-new domain is not in Google's index AT ALL until
    // it is verified and submitted — that, not metadata, is the gate on a brand name appearing in
    // search. Set these as env vars (Vercel → Settings → Environment Variables) and redeploy; no
    // code change needed. Google: Search Console → Add property → HTML tag → copy the content value.
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
        : undefined,
    },
    referrer: "origin-when-cross-origin",
    creator: "MiniRue",
    publisher: "MiniRue",
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "MiniRue",
      title: "MiniRue — Original Cosmetics & Perfumes | Mini Rue Shop",
      description:
        "Discover MiniRue (Mini Rue) — original cosmetics & perfumes, in luxury packaging.",
      url: BASE_URL,
      // No `images` override here: app/opengraph-image.tsx (edge ImageResponse)
      // is the Next.js file-convention OG image and is resolved automatically.
      // An explicit override used to shadow it with a URL that 404s.
    },
    twitter: {
      card: "summary_large_image",
      title: "MiniRue — Original Cosmetics & Perfumes | Mini Rue Shop",
      description:
        "Discover MiniRue (Mini Rue) — original cosmetics & perfumes.",
      // No `images` override — falls back to app/opengraph-image.tsx, same as
      // openGraph above (there is no separate twitter-image.tsx).
    },
    icons: buildIcons(),
  };

  try {
    const settings = await apiGetPublicSettings();
    metadata.icons = buildIcons(settings.storefront.faviconUrl);
  } catch {
    // default icons
  }

  return metadata;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  // NOTE: the WebSite node that used to be built here has been removed. It
  // declared the same `@id` (`/#website`) as the one inside <OrganizationSchema>
  // two lines below, so every page emitted two conflicting definitions of the
  // same entity — and the loser was the richer one, which carries the brand
  // alternateNames and the SearchAction that makes the site eligible for a
  // sitelinks search box. One node, one @id.

  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
      {META_PIXEL_ID && (
        <head>
          {/* Meta Pixel Code — placed in <head> on every page, as Events
              Manager instructs. Route-change PageViews: components/seo/MetaPixel.tsx. */}
          <script
            id="meta-pixel"
            dangerouslySetInnerHTML={{ __html: metaPixelBaseCode(META_PIXEL_ID) }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
          {/* End Meta Pixel Code */}
        </head>
      )}
      <body
        suppressHydrationWarning
        style={
          {
            "--mr-font-serif": "var(--font-cormorant), 'Didot', Georgia, serif",
            "--mr-font-label":
              "var(--font-jost), 'Futura', system-ui, sans-serif",
            "--mr-font-ui":
              "var(--font-inter-tight), 'Inter', system-ui, -apple-system, sans-serif",
          } as React.CSSProperties
        }
      >
        {/*
          This order is a permanent invariant — do not reorder. (These are the
          children of `.mr-app-layer` below rather than of <body> directly
          since #57; the layer is a plain wrapper and changes none of the
          reasoning here.)
          1. OrganizationSchema — never inside any Suspense. It is the
             site-identity JSON-LD; it must be present in the initial server
             HTML on every route, unconditionally.
          2. RootQueryProvider (and everything it wraps) — the real page
             content, server-rendered synchronously so crawlers get a full
             body instead of an empty shell.
          3. The telemetry Suspense boundary — the only thing allowed behind
             `fallback={null}`. Everything inside it is third-party
             telemetry that reads router state internally and renders null,
             so nothing indexable ever sits behind it. Anything added here
             must keep that property.
        */}
        {/*
          THE APP LAYER — one stacking context around the whole application,
          and the reason the pre-September footer could come back (#57).

          History, because this looks like a stray wrapper and is not:

          The footer that shipped before September was `position: sticky;
          bottom: 0; z-index: 0`, rendered AFTER `.mr-page-sheet`, with no
          JavaScript and nothing written to `body`. It worked because
          `.mr-page-sheet` carried `position: relative; z-index: 1`: the page
          out-ranked the footer, so the footer sat behind it and was uncovered
          as the page scrolled up off it. `00cd9ec` (#25) removed that one
          line — correctly, because a stacking context on the page sheet seals
          the mobile nav sheet (60), the search sheet (120), `MobileSheet` (60)
          and the review lightbox (70) beneath the root-mounted bottom nav (20);
          that is #6, and `__tests__/layout/page-sheet-stacking.test.ts` exists
          to keep it fixed. But removing it also removed the only thing holding
          the footer down, and five footer rewrites followed, each fixing a
          symptom in the wrong file.

          This wrapper is where that `z-index` belongs. It contains BOTH the
          page and every root-mounted overlay — the cart drawer, the support
          widget, the bottom nav, the page loader — so every existing z-index in
          the app is still resolved against every other one exactly as it was:
          nothing is sealed, and #6 stays fixed. What it changes is only what is
          OUTSIDE it: `body`'s own painted box. That is what lets the footer sit
          at `z-index: -1` INSIDE this layer and still take its own clicks —
          the earlier `z-index: -1` attempt died because it was scoped to the
          root stacking context, where `body`'s background box paints above a
          negative-z-index box and swallowed every footer link. Here the whole
          layer paints above `body`, so the footer does too.

          Do not remove the z-index, and do not move the footer out of this
          layer. See components/layout/Footer.tsx and
          __tests__/layout/footer-stacking.test.ts.
        */}
        <div className="mr-app-layer">
        <OrganizationSchema />
        <RootQueryProvider>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <StorefrontLiveUpdates />
            <SessionExpiredHandler />
            {/* Mounted once, here, above every route — same reason
                CartProvider lives here. Each checkout (and most
                storefront) step is its own route with no shared layout,
                so a plain useState inside AnnouncementBar reset on every
                navigation and the bar reappeared each time it collapsed.
                Root layout state survives client-side navigation and
                resets on a real refresh, which is what dismissing the bar
                should do. */}
            <AnnouncementBarProvider>
              {/* One fetch for the whole app. Every product card needs the same
                  single percentage, and thirty cards asking separately would
                  make the price — the thing a shopper reads first — the
                  slowest element on a listing page. */}
              <SitewideDiscountProvider>
              <CartProvider>
                {/* SupportProvider must wrap {children} too — pages call
                    useSupportContext() to set the widget's default subject
                    (e.g. the product being viewed). Wrapping only the widget
                    made every such page throw. */}
                <SupportProvider>
                  <LenisProvider>{children}</LenisProvider>
                  <CartDrawer />
                  <SupportWidget />
                  {/* W4a.2: mounted once, globally — same tier as CartDrawer
                      and SupportWidget above — rather than per-page, so it
                      exists even on routes (checkout, account, home) that
                      each construct their own Header instance
                      independently. It talks to that Header purely through
                      shared client state (lib/hooks/useMobileChrome.ts,
                      CartContext), never as a prop, since there is no
                      single call site to thread one through. */}
                  <MobileBottomNav />
                </SupportProvider>
              </CartProvider>
              </SitewideDiscountProvider>
            </AnnouncementBarProvider>
          </HydrationBoundary>
        </RootQueryProvider>
        {/* Task 43 (2026-07-31): mounted once, globally, same tier as
            CartDrawer/SupportWidget/MobileBottomNav above — it has to
            persist across every client-side navigation (never remounted
            per-route) so its own fade-out can actually play; see
            PageLoader.tsx. */}
        <PageLoader />
        <Suspense fallback={null}>
          {/* telemetry only. Vercel Analytics + Speed Insights were removed
              (#144): the storefront runs as a Docker image on Dokploy, where
              their /_vercel/* endpoints do not exist, so they shipped JS and
              collected nothing. */}
          <AnalyticsProvider />
          <MetaPixel />
        </Suspense>
        </div>
      </body>
    </html>
  );
}

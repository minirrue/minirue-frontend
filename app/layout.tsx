import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Jost, Inter_Tight } from "next/font/google";
import "./globals.css";
import LenisProvider from "@/components/providers/LenisProvider";
import OrganizationSchema from "@/components/seo/OrganizationSchema";
import { JsonLd } from "@/components/seo/JsonLd";
import { CartProvider } from "@/components/storefront/cart/CartContext";
import CartDrawer from "@/components/storefront/cart/CartDrawer";
import { RootQueryProvider, getQueryClient } from "@/lib/hooks";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SessionExpiredHandler from "@/components/auth/SessionExpiredHandler";
import StorefrontLiveUpdates from "@/components/providers/StorefrontLiveUpdates";
import { apiGetPublicSettings } from "@/lib/api/settings";

const BASE_URL = "https://minirueshop.com";

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
  // Light-only storefront. A dark themeColor variant made the browser chrome (and, on a
  // dark-mode OS, the pre-paint canvas) go near-black between pages — see globals.css.
  themeColor: "#F6F2E9", // --mr-cream-200, matches body + .mr-page-sheet
};

export async function generateMetadata(): Promise<Metadata> {
  const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: {
      // The spaced alias is deliberate: users search "mini rue shop" and the site never surfaced,
      // because no on-page text or entity ever spelled the brand with a space. The title is the
      // strongest on-page signal, so it carries the exact queried phrase once, naturally.
      default: "MiniRue — Original Quality Perfumes | Mini Rue Shop",
      template: "%s | MiniRue (Mini Rue)",
    },
    description:
      "Discover MiniRue (Mini Rue) — original quality perfumes and cosmetics. Free worldwide shipping, luxury packaging, duty-paid to 62 countries.",
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
      title: "MiniRue — Original Quality Perfumes | Mini Rue Shop",
      description:
        "Discover MiniRue (Mini Rue) — original quality perfumes and cosmetics. Free worldwide shipping, luxury packaging, duty-paid to 62 countries.",
      url: BASE_URL,
      images: [
        {
          url: `${BASE_URL}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: "MiniRue",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "MiniRue — Original Quality Perfumes | Mini Rue Shop",
      description:
        "Discover MiniRue (Mini Rue) — original quality perfumes and cosmetics.",
      images: [`${BASE_URL}/og-image.jpg`],
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
  };

  try {
    const settings = await apiGetPublicSettings();
    const favicon = settings.storefront.faviconUrl;
    if (favicon) {
      metadata.icons = { icon: favicon, apple: "/apple-touch-icon.png" };
    }
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
  const websiteSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    url: BASE_URL,
    name: "MiniRue",
    description:
      "Discover MiniRue — original quality perfumes and cosmetics.",
    publisher: {
      "@id": `${BASE_URL}/#organization`,
    },
  };

  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
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
          Cache Components–compatible opt-out of the static prerender shell.
          Wrapping the body with <Suspense fallback={null}> defers the entire
          subtree to request time, which is the canonical fix when most pages
          rely on request-time data (auth, cart, dynamic catalog, etc.).
          See apps/minirue-obsidian/plans/nextjs16-optimization/RESEARCH.md
          § "Cache Components — Forcing Dynamic Routes".
        */}
        <Suspense fallback={null}>
          <OrganizationSchema />
          <JsonLd data={websiteSchema} />
          <RootQueryProvider>
            <HydrationBoundary state={dehydrate(queryClient)}>
              <StorefrontLiveUpdates />
              <SessionExpiredHandler />
              <CartProvider>
                <LenisProvider>{children}</LenisProvider>
                <CartDrawer />
              </CartProvider>
            </HydrationBoundary>
          </RootQueryProvider>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      </body>
    </html>
  );
}

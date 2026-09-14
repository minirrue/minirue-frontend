import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. frame-ancestors/object-src/base-uri/form-action are
// enforced strictly (they don't affect rendering, so zero breakage risk).
// NOTE: script-src still allows 'unsafe-inline' because Next's App Router
// injects inline hydration scripts. TODO(security): move to a nonce-based
// script-src via proxy/middleware and drop 'unsafe-inline'. Dev adds
// 'unsafe-eval' + ws/http so HMR keeps working.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // connect.facebook.net serves the Meta Pixel (components/seo/MetaPixel.tsx).
  `script-src 'self' 'unsafe-inline' https://connect.facebook.net${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https:${isProd ? "" : " ws: wss: http:"}`,
  "frame-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS only in production — browsers ignore it on localhost, but keep it out
  // of dev responses to avoid pinning a stale policy on shared dev hosts.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Storefront pages are canonical at /<slug>. This is a config-level
  // redirect rather than permanentRedirect() in the page. It used to be
  // required for a reason that no longer holds: the root layout used to
  // stream the whole body inside a body-wide <Suspense fallback={null}>, so
  // by the time the page component ran the response had already started and
  // Next could only fall back to a client-side redirect — crawlers saw an
  // empty 200 instead of a 308. That boundary has since been removed from
  // app/layout.tsx (see the cacheComponents comment below for the full
  // story), so the original justification is gone — but the redirect stays
  // here rather than moving into the two page components: it already works,
  // and splitting one redirect into two page-level ones would be a change
  // with no upside.
  async redirects() {
    return [
      { source: "/pages/:slug", destination: "/:slug", permanent: true },
      // A partner used to live at /brands/<slug>; they now own /<slug>
      // outright. Permanent so anything already shared — a link in an
      // Instagram bio, an existing Google result — keeps landing, and so the
      // ranking follows the new address rather than splitting across two.
      { source: "/brands/:slug", destination: "/:slug", permanent: true },
      /**
       * `/brands` retired 2026-08-21 — /collab already showed the same makers
       * from the same source (`apiListPublicBrands()`), so the shop had two
       * pages answering one question (owner: "delete this page, we already
       * have /collab").
       *
       * Redirected rather than deleted outright: it was in the sitemap, so it
       * is indexed, and a 404 would throw away whatever standing those results
       * have instead of handing it to the page that replaced it. Permanent, so
       * search engines move rather than keep asking.
       */
      { source: "/brands", destination: "/collab", permanent: true },

      /**
       * The shop had two front doors; it now has one.
       *
       * `/categories` rendered a page titled "Shop" — a URL disagreeing with
       * its own heading — and `/products` was a second flat catalogue reached
       * from a tile on it. The owner asked for one entry point and for a URL
       * to match the title of the page it opens (2026-08-21). The whole scheme
       * is written down in `lib/routes.ts`.
       *
       * Permanent, for the same reason the partner redirect above is: these
       * paths are indexed and shared, so the ranking has to follow the new
       * address rather than split across two.
       *
       * `/products/:slug` is NOT here. Its destination depends on the
       * product's category, which no static rule can supply, so it is a page
       * that looks the product up and forwards — see
       * app/products/[slug]/page.tsx.
       */
      { source: "/categories", destination: "/shop", permanent: true },
      { source: "/categories/:slug", destination: "/shop/:slug", permanent: true },
      { source: "/products", destination: "/shop/all", permanent: true },
      /**
       * `/orders/[id]/confirmation` retired (#121). It was a Server Component
       * that called a client-only function on every order and so printed
       * "We could not load your order details" for all of them — and, running
       * on the storefront host, it never had the shopper's API cookies to ask
       * with. Nothing has linked to it since checkout moved to
       * /checkout/confirmation. An old link still means "show me that order",
       * which the account order page does, by the same id.
       */
      { source: "/orders/:id/confirmation", destination: "/account/orders/:id", permanent: true },
      /**
       * `/orders/[id]/track` retired (#125) for the same reason: a Server
       * Component calling the API without the shopper's cookies and through
       * a client-only function, so every order read "We could not find that
       * order". Nothing links to it. Its order progress now shows on the
       * account order page, by the same id.
       */
      { source: "/orders/:id/track", destination: "/account/orders/:id", permanent: true },
    ];
  },
  reactCompiler: true,
  // Cache Components (PPR) is OFF deliberately. It was enabled once, and the
  // body-wide <Suspense fallback={null}> that used to wrap the root layout
  // was never load-bearing for correctness — it was added (commit a2bbd63)
  // purely to satisfy cacheComponents' "Uncached data was accessed outside
  // of <Suspense>" build error. What it actually did in production was mask
  // a PPR resume mismatch: the build-time shell had to be "resumed" per
  // request, and when the replayed tree did not match, React discarded the
  // server HTML ("Couldn't find all resumable slots by key/index during
  // replaying", 26+ hits on /products/[slug] and /brands/[brand]) — and
  // because it happened behind that null fallback, the result was a blank
  // page instead of a visible error.
  //
  // That Suspense boundary has since been removed from app/layout.tsx (the
  // whole body now renders synchronously; only third-party telemetry sits
  // behind a narrow Suspense). The resume-mismatch bug itself is UNFIXED —
  // removing the boundary only removed the thing that hid it. With
  // cacheComponents: false there is no prerender shell to resume, so this
  // failure mode cannot fire at all. If cacheComponents is re-enabled, the
  // mismatch would surface as a visible rendering error rather than a blank
  // page, which is strictly better but still a production bug.
  //
  // Do not re-enable cacheComponents without retesting /products/[slug] and
  // /brands/[brand] under load. The cacheLife profiles below are kept for
  // when this is revisited.
  cacheComponents: false,
  cacheLife: {
    products: {
      stale: 60,        // 1 min fresh
      revalidate: 300,   // 5 min before background refresh
      expire: 3600,      // 1 hour max
    },
    productDetail: {
      stale: 300,        // 5 min fresh
      revalidate: 900,   // 15 min before background refresh
      expire: 86400,     // 24 hours max
    },
    categories: {
      stale: 300,        // 5 min fresh
      revalidate: 900,   // 15 min before refresh
      expire: 86400,     // 24 hours max
    },
    brands: {
      stale: 300,
      revalidate: 900,
      expire: 86400,
    },
    settings: {
      stale: 300,
      revalidate: 900,
      expire: 86400,
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "img.minirueshop.com" },
      { protocol: "https", hostname: "storage.minirueshop.com" },
    ],
  },
};

export default nextConfig;

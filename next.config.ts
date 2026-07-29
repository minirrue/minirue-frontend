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
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
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
  // Storefront pages are canonical at /<slug>. This has to be a config-level
  // redirect, not permanentRedirect() in the page: the root layout streams
  // inside <Suspense>, so by the time the page component runs the response has
  // already started and Next can only fall back to a client-side redirect —
  // crawlers saw an empty 200 instead of a 308.
  async redirects() {
    return [
      { source: "/pages/:slug", destination: "/:slug", permanent: true },
      // A partner used to live at /brands/<slug>; they now own /<slug>
      // outright. Permanent so anything already shared — a link in an
      // Instagram bio, an existing Google result — keeps landing, and so the
      // ranking follows the new address rather than splitting across two.
      { source: "/brands/:slug", destination: "/:slug", permanent: true },
    ];
  },
  reactCompiler: true,
  // Cache Components (PPR) is OFF deliberately. The root layout already wraps
  // the whole body in <Suspense fallback={null}> to defer every route to
  // request time, so partial prerendering bought nothing here — but its
  // build-time shell still had to be "resumed" per request, and when the
  // replayed tree did not match React discarded the server HTML ("Couldn't
  // find all resumable slots by key/index during replaying", 26+ hits in
  // production on /products/[slug] and /brands/[brand]). Behind that null
  // fallback the result was a blank page. The cacheLife profiles below are
  // kept for when this is revisited.
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

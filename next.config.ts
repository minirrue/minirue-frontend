import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  cacheComponents: true,
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
    ],
  },
};

export default nextConfig;

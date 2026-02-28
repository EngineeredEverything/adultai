import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true, // Enable gzip compression on all responses
  poweredByHeader: false,
  env: {
    PORT: process.env.PORT || "3569",
    NEXTAUTH_URL: new URL(
      `${process.env.APP_URL || "https://adultai.noerror.studio"}`
    ).href,
  },
  // Long-term cache headers for static assets (hashed filenames = safe to cache forever)
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  images: {
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days in seconds
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [64, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "adultai-com.b-cdn.net",
      },
      {
        protocol: "https",
        hostname: "**.bunnycdn.com",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "cdn-edge-us.magnimont.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-slider",
      "@radix-ui/react-tabs",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;

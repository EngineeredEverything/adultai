import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    PORT: process.env.PORT || "3569",
    NEXTAUTH_URL: new URL(
      `${process.env.APP_URL || "https://adultai.noerror.studio"}`
    ).href,
  },
  images: {
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days in seconds
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
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;

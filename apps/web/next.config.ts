import type { NextConfig } from "next";

/** Marketing site + public profiles. All /api traffic proxies to the
 *  dedicated SiegeIQ API service (apps/api). */
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@siegeiq/shared",
    "@siegeiq/game-data",
    "@siegeiq/coaching",
    "@siegeiq/server",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ubisoft-avatars.akamaized.net" },
      { protocol: "https", hostname: "staticctf.akamaized.net" },
    ],
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

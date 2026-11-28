import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // На Vercel режим standalone не используется (он ломает NFT-трейсинг Vercel: next-server.js.nft.json)
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  outputFileTracingIncludes: {
    "/api/**": ["./src/data/compendium/monsters/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  allowedDevOrigins: [
    "*.*.*.*",
    "26.*.*.*",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
    "*.localhost",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;

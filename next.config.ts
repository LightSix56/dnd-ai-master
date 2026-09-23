import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // На Vercel режим standalone не используется (он ломает NFT-трейсинг Vercel: next-server.js.nft.json)
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
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

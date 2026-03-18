import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "account.maxion.gg" },
      { protocol: "https", hostname: "cdn.prod.website-files.com" },
      { protocol: "https", hostname: "cdn.maxion.gg" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "images.spr.so" },
    ],
  },
  webpack: (config) => {
    // Stub out unused wagmi connector dependencies to avoid build errors
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/wallet-sdk": false,
    };
    return config;
  },
};

export default nextConfig;

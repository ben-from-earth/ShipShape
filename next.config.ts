import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.4 defaults. Partial prerendering stays on so pages can mix
  // a static shell with dynamic data as the UI grows.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

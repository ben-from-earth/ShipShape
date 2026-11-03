import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.4 defaults. Partial prerendering stays on so pages can mix
  // a static shell with dynamic data as the UI grows.
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
  },
  // Transformers.js and ONNX use native bindings and dynamic requires.
  // Next already externalizes both; listing them keeps document embedding
  // out of the server bundle if that default changes.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
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

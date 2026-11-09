import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  devIndicators: false,
  // The offline build keeps its own folder, so it and `next dev` never overwrite each other.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Claim photos travel through Server Actions; the 1 MB default is too small.
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;

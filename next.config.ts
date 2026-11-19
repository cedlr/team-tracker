import type { NextConfig } from "next";

/**
 * Every page is per user and per team (session + team cookie), so pages render on request.
 * Cache Components / Partial Prefetching are off to keep that model simple.
 */
const nextConfig: NextConfig = {
  cacheComponents: false,
};

export default nextConfig;

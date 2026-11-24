import type { NextConfig } from "next";

// Server mode (not a static export): the PIN login, the proxy guard and the local API need a running Next server.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;

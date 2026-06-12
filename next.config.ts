import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
    ],
    // Next 16 blocks the image optimizer from fetching private IPs.
    // Local Supabase storage serves from 127.0.0.1:54321, so allow it in dev.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
};

export default nextConfig;

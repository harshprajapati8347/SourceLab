import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${apiUrl}/api/auth/:path*`,
      },
      {
        source: "/api/workspaces/:path*",
        destination: `${apiUrl}/api/workspaces/:path*`,
      },
      {
        source: "/api/workspaces",
        destination: `${apiUrl}/api/workspaces`,
      },
    ];
  },
};

export default nextConfig;

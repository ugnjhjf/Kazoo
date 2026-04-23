import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Kazoo",
  trailingSlash: true,
  allowedDevOrigins: ['192.168.224.129', 'localhost'],
};

export default nextConfig;

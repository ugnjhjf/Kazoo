import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Kazoo",
  allowedDevOrigins: ['192.168.224.129', 'localhost'],
};

export default nextConfig;

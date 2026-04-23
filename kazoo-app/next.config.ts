import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/Kazoo" : "",
  trailingSlash: true,
  allowedDevOrigins: ['192.168.224.129', '10.11.75.150', 'localhost'],
};

export default nextConfig;

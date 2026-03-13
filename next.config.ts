import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://localhost:3009", "http://127.0.0.1:3009"],
  devIndicators: false,
  output: 'standalone'
};

export default nextConfig;

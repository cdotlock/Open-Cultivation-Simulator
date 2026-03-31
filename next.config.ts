import type { NextConfig } from "next";
import os from "os";

function getLocalIPv4s() {
  const ips: string[] = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const addrs = nets[name] ?? [];
    for (const addr of addrs) {
      if (addr && addr.family === "IPv4" && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

const localIps = getLocalIPv4s();
const allowedOrigins = [
  "localhost",
  "127.0.0.1",
  "localhost:3009",
  "127.0.0.1:3009",
  ...localIps,
  ...localIps.map(ip => `${ip}:3009`),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  devIndicators: false,
  output: 'standalone'
};

export default nextConfig;

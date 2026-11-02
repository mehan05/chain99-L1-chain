import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_RPC_URL:
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      process.env.CHAIN99_RPC_URL ||
      "",
    RPC_URL:
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      process.env.CHAIN99_RPC_URL ||
      "",
  },
};

export default nextConfig;

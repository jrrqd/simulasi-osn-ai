import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "postgres",
    "better-auth",
    "@better-auth/drizzle-adapter",
    "@electric-sql/pglite",
  ],
};

export default nextConfig;

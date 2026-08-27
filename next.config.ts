import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["knex", "better-sqlite3"],
};

export default nextConfig;
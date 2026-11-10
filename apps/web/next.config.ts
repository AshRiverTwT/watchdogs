import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  transpilePackages: ["@watchdogs/core", "@watchdogs/db"],
};

export default config;

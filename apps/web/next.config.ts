import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/** Walk up from the cwd to the folder holding pnpm-workspace.yaml. */
function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
  return dir;
}

const root = findRepoRoot();

// One .env at the repo root serves web, worker and scripts.
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  /* no root .env: rely on the real environment */
}

const config: NextConfig = {
  outputFileTracingRoot: root,
  transpilePackages: ["@watchdogs/core", "@watchdogs/db", "@watchdogs/auth", "@watchdogs/mail"],
  serverExternalPackages: ["@node-rs/argon2", "@electric-sql/pglite", "postgres", "nodemailer"],
  poweredByHeader: false,
};

export default config;

import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;
/** Driver-agnostic handle: postgres-js in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

/**
 * DATABASE_URL forms:
 *   postgres://user:pass@host:5432/db   real Postgres (Docker, RDS, local install)
 *   pglite://./.pgdata                  in-process PGlite, for single-process dev without Docker
 */
export async function createDb(url = process.env.DATABASE_URL): Promise<Db> {
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dir = url.slice("pglite://".length);
    return drizzle(new PGlite(dir || undefined), { schema }) as unknown as Db;
  }
  const client = postgres(url, { max: 10 });
  return drizzlePostgres(client, { schema }) as unknown as Db;
}

export { schema };
export * from "./schema";
export * from "./queries/catalog";
export * from "./queries/alerts";

import "server-only";
import { type Db, createDb } from "@watchdogs/db";

const g = globalThis as unknown as { __wdDb?: Promise<Db> };

/** One pool per process, surviving dev hot reloads. */
export function getDb(): Promise<Db> {
  g.__wdDb ??= createDb();
  return g.__wdDb;
}

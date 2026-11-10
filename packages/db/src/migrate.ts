import { migrationsFolder } from "./paths";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

if (url.startsWith("pglite://")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(url.slice("pglite://".length) || undefined);
  await migrate(drizzle(client), { migrationsFolder });
  await client.close();
} else {
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder });
  await client.end();
}
console.log("migrations applied");

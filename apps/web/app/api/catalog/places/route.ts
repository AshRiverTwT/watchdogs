import { listAreas, listCities } from "@watchdogs/db";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Cities with their areas nested. */
export async function GET() {
  const db = await getDb();
  const cities = await listCities(db);
  const result = await Promise.all(
    cities.map(async (c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      regionCode: c.bmsRegionCode,
      areas: (await listAreas(db, c.id)).map(({ id, name, slug }) => ({ id, name, slug })),
    })),
  );
  return json({ cities: result });
}

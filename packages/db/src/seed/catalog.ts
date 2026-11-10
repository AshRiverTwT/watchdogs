import { eq, inArray } from "drizzle-orm";
import { slugify } from "@watchdogs/core";
import type { Db } from "../index";
import { formats, movieBmsEvents, movies, places, theatreFormats, theatres } from "../schema";
import { AREAS, CITY, FORMATS, SAMPLE_MOVIES, THEATRES } from "./data";


export interface SeedOptions {
  sampleMovies?: boolean;
}

/** Inserts missing catalog rows; never overwrites existing ones. Safe to run repeatedly. */
export async function seedCatalog(db: Db, opts: SeedOptions = {}) {
  await db.insert(formats).values(FORMATS).onConflictDoNothing();

  await db.insert(places).values({ kind: "city", ...CITY }).onConflictDoNothing();
  const [city] = await db.select().from(places).where(eq(places.slug, CITY.slug));
  if (!city) throw new Error("city row missing after insert");

  await db
    .insert(places)
    .values(AREAS.map((name) => ({ kind: "area" as const, parentId: city.id, name, slug: `${CITY.slug}-${slugify(name)}` })))
    .onConflictDoNothing();
  const areaRows = await db.select().from(places).where(eq(places.parentId, city.id));
  const areaId = new Map(areaRows.map((a) => [a.name, a.id]));

  await db
    .insert(theatres)
    .values(
      THEATRES.map((t) => {
        const placeId = areaId.get(t.area);
        if (!placeId) throw new Error(`unknown area ${t.area} for ${t.name}`);
        return { name: t.name, slug: slugify(`${t.name} ${t.area}`), placeId };
      }),
    )
    .onConflictDoNothing();

  const formatRows = await db.select().from(formats);
  const formatId = new Map(formatRows.map((f) => [f.code, f.id]));
  const theatreRows = await db
    .select()
    .from(theatres)
    .where(inArray(theatres.slug, THEATRES.map((t) => slugify(`${t.name} ${t.area}`))));
  const theatreId = new Map(theatreRows.map((t) => [t.slug, t.id]));
  const links = THEATRES.flatMap((t) =>
    t.formats.map((code) => ({
      theatreId: theatreId.get(slugify(`${t.name} ${t.area}`))!,
      formatId: formatId.get(code)!,
    })),
  ).filter((l) => l.theatreId && l.formatId);
  if (links.length) await db.insert(theatreFormats).values(links).onConflictDoNothing();

  if (opts.sampleMovies !== false) {
    for (const m of SAMPLE_MOVIES) {
      const { events, ...movie } = m;
      const slug = slugify(movie.title);
      await db.insert(movies).values({ ...movie, slug }).onConflictDoNothing();
      const [row] = await db.select({ id: movies.id }).from(movies).where(eq(movies.slug, slug));
      await db
        .insert(movieBmsEvents)
        .values(events.map((e) => ({ ...e, movieId: row!.id })))
        .onConflictDoNothing();
    }
  }

  const count = async (table: typeof formats | typeof places | typeof theatres | typeof movies) =>
    (await db.select().from(table)).length;
  return {
    formats: await count(formats),
    places: await count(places),
    theatres: await count(theatres),
    movies: await count(movies),
  };
}


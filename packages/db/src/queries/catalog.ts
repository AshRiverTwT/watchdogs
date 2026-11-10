import { and, asc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { Db } from "../index";
import {
  type Movie,
  type MovieBmsEvent,
  formats,
  movieBmsEvents,
  movieStatus,
  movies,
  places,
  theatreFormats,
  theatres,
} from "../schema";

type MovieStatus = (typeof movieStatus.enumValues)[number];

/** Escape LIKE wildcards in user input. */
function likeTerm(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listFormats(db: Db, opts: { includeInactive?: boolean } = {}) {
  return db
    .select()
    .from(formats)
    .where(opts.includeInactive ? undefined : eq(formats.active, true))
    .orderBy(asc(formats.sortOrder), asc(formats.name));
}

export async function listCities(db: Db, opts: { includeInactive?: boolean } = {}) {
  return db
    .select()
    .from(places)
    .where(and(eq(places.kind, "city"), opts.includeInactive ? undefined : eq(places.active, true)))
    .orderBy(asc(places.name));
}

export async function listAreas(db: Db, cityId: string, opts: { includeInactive?: boolean } = {}) {
  return db
    .select()
    .from(places)
    .where(and(eq(places.parentId, cityId), opts.includeInactive ? undefined : eq(places.active, true)))
    .orderBy(asc(places.name));
}

export interface TheatreListItem {
  id: string;
  name: string;
  slug: string;
  bmsVenueCode: string | null;
  address: string | null;
  active: boolean;
  area: { id: string; name: string };
  cityId: string;
  formatIds: string[];
}

export async function listTheatres(
  db: Db,
  opts: { cityId?: string; areaId?: string; formatId?: string; q?: string; includeInactive?: boolean; ids?: string[] } = {},
): Promise<TheatreListItem[]> {
  if (opts.ids && opts.ids.length === 0) return [];
  const where: (SQL | undefined)[] = [
    opts.includeInactive ? undefined : eq(theatres.active, true),
    opts.cityId ? eq(places.parentId, opts.cityId) : undefined,
    opts.areaId ? eq(theatres.placeId, opts.areaId) : undefined,
    opts.q ? or(ilike(theatres.name, likeTerm(opts.q)), ilike(places.name, likeTerm(opts.q))) : undefined,
    opts.ids ? inArray(theatres.id, opts.ids) : undefined,
  ];

  const rows = await db
    .select({ theatre: theatres, area: places })
    .from(theatres)
    .innerJoin(places, eq(places.id, theatres.placeId))
    .where(and(...where))
    .orderBy(asc(theatres.name));
  if (rows.length === 0) return [];

  const links = await db
    .select()
    .from(theatreFormats)
    .where(inArray(theatreFormats.theatreId, rows.map((r) => r.theatre.id)));
  const byTheatre = new Map<string, string[]>();
  for (const l of links) byTheatre.set(l.theatreId, [...(byTheatre.get(l.theatreId) ?? []), l.formatId]);

  return rows
    .map((r) => ({
      id: r.theatre.id,
      name: r.theatre.name,
      slug: r.theatre.slug,
      bmsVenueCode: r.theatre.bmsVenueCode,
      address: r.theatre.address,
      active: r.theatre.active,
      area: { id: r.area.id, name: r.area.name },
      cityId: r.area.parentId!,
      formatIds: byTheatre.get(r.theatre.id) ?? [],
    }))
    .filter((t) => !opts.formatId || t.formatIds.includes(opts.formatId));
}

export type MovieWithEvents = Movie & { events: MovieBmsEvent[] };

async function attachEvents(db: Db, rows: Movie[], includeInactive = false): Promise<MovieWithEvents[]> {
  if (rows.length === 0) return [];
  const events = await db
    .select()
    .from(movieBmsEvents)
    .where(
      and(
        inArray(movieBmsEvents.movieId, rows.map((m) => m.id)),
        includeInactive ? undefined : eq(movieBmsEvents.active, true),
      ),
    )
    .orderBy(asc(movieBmsEvents.language));
  return rows.map((m) => ({ ...m, events: events.filter((e) => e.movieId === m.id) }));
}

export async function listMovies(
  db: Db,
  opts: { status?: MovieStatus[]; q?: string; includeInactive?: boolean } = {},
): Promise<MovieWithEvents[]> {
  const rows = await db
    .select()
    .from(movies)
    .where(
      and(
        opts.includeInactive ? undefined : eq(movies.active, true),
        opts.status?.length ? inArray(movies.status, opts.status) : undefined,
        opts.q ? ilike(movies.title, likeTerm(opts.q)) : undefined,
      ),
    )
    .orderBy(asc(movies.title));
  return attachEvents(db, rows, opts.includeInactive);
}

export async function getMovieBySlug(db: Db, slug: string): Promise<MovieWithEvents | null> {
  const [row] = await db
    .select()
    .from(movies)
    .where(and(eq(movies.slug, slug), eq(movies.active, true)))
    .limit(1);
  if (!row) return null;
  return (await attachEvents(db, [row]))[0]!;
}

/**
 * For each chosen theatre, the chosen formats it is not known to screen.
 * Used to warn (not block) when an alert asks for e.g. EPIQ at a theatre without it.
 */
export async function unsupportedFormats(
  db: Db,
  theatreIds: string[],
  formatIds: string[],
): Promise<{ theatreId: string; formatIds: string[] }[]> {
  if (theatreIds.length === 0 || formatIds.length === 0) return [];
  const links = await db
    .select()
    .from(theatreFormats)
    .where(and(inArray(theatreFormats.theatreId, theatreIds), inArray(theatreFormats.formatId, formatIds)));
  return theatreIds
    .map((theatreId) => ({
      theatreId,
      formatIds: formatIds.filter((f) => !links.some((l) => l.theatreId === theatreId && l.formatId === f)),
    }))
    .filter((r) => r.formatIds.length > 0);
}

import "server-only";
import { addDays, ALERT_LIMITS, istToday } from "@watchdogs/core";
import { listAreas, listCities, listFormats, listMovies, listTheatres } from "@watchdogs/db";
import { getDb } from "./db";

/** Everything the alert form needs, shaped for the client. Only the first city for now. */
export async function loadAlertFormData() {
  const db = await getDb();
  const [city] = await listCities(db);
  if (!city) throw new Error("No city in the catalog. Run `pnpm db:seed`.");
  const [areas, theatres, formats, movies] = await Promise.all([
    listAreas(db, city.id),
    listTheatres(db, { cityId: city.id }),
    listFormats(db),
    listMovies(db, { status: ["now_showing", "upcoming"] }),
  ]);
  const today = istToday();
  return {
    today,
    maxDate: addDays(today, ALERT_LIMITS.maxDaysAhead),
    limits: ALERT_LIMITS,
    city: { id: city.id, name: city.name },
    areas: areas.map(({ id, name }) => ({ id, name })),
    theatres: theatres.map((t) => ({ id: t.id, name: t.name, areaId: t.area.id, areaName: t.area.name, formatIds: t.formatIds })),
    formats: formats.map(({ id, name }) => ({ id, name })),
    movies: movies.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      language: m.language,
      variants: m.events.map((e) => ({ id: e.id, label: e.formatHint ? `${e.language} · ${e.formatHint}` : e.language })),
    })),
  };
}

export type AlertFormData = Awaited<ReturnType<typeof loadAlertFormData>>;

import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  type AlertDraft,
  type AlertErrors,
  ALERT_LIMITS,
  normalizeDates,
  remainingDates,
  toHHMM,
  validateAlertDraft,
} from "@watchdogs/core";
import type { Db } from "../index";
import {
  type Alert,
  type AlertHistoryKind,
  type AlertStatus,
  alertEvents,
  alertFormats,
  alertHistory,
  alertPlaces,
  alertTheatres,
  alerts,
  formats,
  movieBmsEvents,
  movies,
  places,
  theatres,
  users,
} from "../schema";
import { listTheatres, unsupportedFormats } from "./catalog";

export interface FormatWarning {
  theatreId: string;
  theatreName: string;
  formatNames: string[];
}

export type AlertSaveResult =
  | { ok: true; alertId: string }
  | { ok: false; errors: AlertErrors; warnings?: undefined }
  | { ok: false; errors?: undefined; warnings: FormatWarning[] };

export interface AlertView {
  id: string;
  /** Stored status, except active/paused alerts with no dates left read as "expired". */
  status: AlertStatus;
  mode: Alert["mode"];
  movie: { id: string; title: string; slug: string; posterPath: string | null };
  cityId: string;
  dates: string[];
  remainingDates: string[];
  timeStart: string;
  timeEnd: string;
  events: { id: string; language: string; formatHint: string | null }[];
  formats: { id: string; name: string }[];
  theatres: { id: string; name: string; areaName: string }[];
  areas: { id: string; name: string }[];
  lastMatchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const uniq = (ids: string[]) => [...new Set(ids)];

function cleanDraft(d: AlertDraft): AlertDraft {
  return {
    ...d,
    eventIds: uniq(d.eventIds),
    formatIds: uniq(d.formatIds),
    theatreIds: uniq(d.theatreIds),
    areaIds: uniq(d.areaIds),
    dates: [...d.dates],
  };
}

/** Checks that every referenced id exists, is active and belongs together. */
async function checkReferences(db: Db, d: AlertDraft): Promise<{ errors: AlertErrors; warnings: FormatWarning[] }> {
  const errors: AlertErrors = {};

  const [city] = await db
    .select()
    .from(places)
    .where(and(eq(places.id, d.cityId), eq(places.kind, "city"), eq(places.active, true)));
  if (!city) return { errors: { cityId: "Choose a city." }, warnings: [] };

  const [movie] = await db
    .select()
    .from(movies)
    .where(and(eq(movies.id, d.movieId), eq(movies.active, true)));
  if (!movie || movie.status === "archived") errors.movieId = "That movie is not available.";

  if (d.eventIds.length) {
    const evs = await db
      .select({ id: movieBmsEvents.id })
      .from(movieBmsEvents)
      .where(
        and(
          inArray(movieBmsEvents.id, d.eventIds),
          eq(movieBmsEvents.movieId, d.movieId),
          eq(movieBmsEvents.active, true),
        ),
      );
    if (evs.length !== d.eventIds.length) errors.eventIds = "Pick languages from the list for this movie.";
  }

  let formatNames = new Map<string, string>();
  if (d.formatIds.length) {
    const fs = await db
      .select()
      .from(formats)
      .where(and(inArray(formats.id, d.formatIds), eq(formats.active, true)));
    if (fs.length !== d.formatIds.length) errors.formatIds = "Pick formats from the list.";
    formatNames = new Map(fs.map((f) => [f.id, f.name]));
  }

  let theatreNames = new Map<string, string>();
  if (d.theatreIds.length) {
    const ts = await listTheatres(db, { cityId: d.cityId, ids: d.theatreIds });
    if (ts.length !== d.theatreIds.length) errors.theatreIds = "Pick theatres from the list.";
    theatreNames = new Map(ts.map((t) => [t.id, t.name]));
  }

  if (d.areaIds.length) {
    const as = await db
      .select({ id: places.id })
      .from(places)
      .where(and(inArray(places.id, d.areaIds), eq(places.parentId, d.cityId), eq(places.active, true)));
    if (as.length !== d.areaIds.length) errors.areaIds = "Pick areas from the list.";
  }

  const warnings: FormatWarning[] = [];
  if (!errors.formatIds && !errors.theatreIds) {
    for (const u of await unsupportedFormats(db, d.theatreIds, d.formatIds)) {
      warnings.push({
        theatreId: u.theatreId,
        theatreName: theatreNames.get(u.theatreId) ?? "Theatre",
        formatNames: u.formatIds.map((id) => formatNames.get(id) ?? "format"),
      });
    }
  }
  return { errors, warnings };
}

async function writeJoins(db: Db, alertId: string, d: AlertDraft) {
  await db.delete(alertEvents).where(eq(alertEvents.alertId, alertId));
  await db.delete(alertFormats).where(eq(alertFormats.alertId, alertId));
  await db.delete(alertTheatres).where(eq(alertTheatres.alertId, alertId));
  await db.delete(alertPlaces).where(eq(alertPlaces.alertId, alertId));
  if (d.eventIds.length) await db.insert(alertEvents).values(d.eventIds.map((eventId) => ({ alertId, eventId })));
  if (d.formatIds.length) await db.insert(alertFormats).values(d.formatIds.map((formatId) => ({ alertId, formatId })));
  if (d.theatreIds.length)
    await db.insert(alertTheatres).values(d.theatreIds.map((theatreId) => ({ alertId, theatreId })));
  if (d.areaIds.length) await db.insert(alertPlaces).values(d.areaIds.map((placeId) => ({ alertId, placeId })));
}

async function addHistory(db: Db, alertId: string, kind: AlertHistoryKind, detail?: string) {
  await db.insert(alertHistory).values({ alertId, kind, detail: detail ?? null });
}

async function validateForSave(
  db: Db,
  d: AlertDraft,
  today: string,
  confirmWarnings: boolean,
): Promise<AlertSaveResult | null> {
  const shape = validateAlertDraft(d, today);
  if (Object.keys(shape).length) return { ok: false, errors: shape };
  const { errors, warnings } = await checkReferences(db, d);
  if (Object.keys(errors).length) return { ok: false, errors };
  if (warnings.length && !confirmWarnings) return { ok: false, warnings };
  return null;
}

export async function createAlert(
  db: Db,
  input: { userId: string; draft: AlertDraft; today: string; confirmWarnings?: boolean },
): Promise<AlertSaveResult> {
  const d = cleanDraft(input.draft);

  const [user] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!user?.emailVerifiedAt) return { ok: false, errors: { form: "Confirm your email before creating alerts." } };

  const [open] = await db
    .select({ n: count() })
    .from(alerts)
    .where(and(eq(alerts.userId, input.userId), isNull(alerts.deletedAt), inArray(alerts.status, ["active", "paused"])));
  if ((open?.n ?? 0) >= ALERT_LIMITS.maxOpenPerUser) {
    return {
      ok: false,
      errors: { form: `You can have ${ALERT_LIMITS.maxOpenPerUser} open alerts. Delete or finish one first.` },
    };
  }

  const invalid = await validateForSave(db, d, input.today, !!input.confirmWarnings);
  if (invalid) return invalid;

  const alertId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(alerts)
      .values({
        userId: input.userId,
        movieId: d.movieId,
        cityId: d.cityId,
        dates: normalizeDates(d.dates),
        timeStart: d.timeStart,
        timeEnd: d.timeEnd,
        mode: d.mode,
      })
      .returning({ id: alerts.id });
    await writeJoins(tx, row!.id, d);
    await addHistory(tx, row!.id, "created");
    return row!.id;
  });
  return { ok: true, alertId };
}

async function getOwned(db: Db, userId: string, alertId: string) {
  const [row] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId), isNull(alerts.deletedAt)));
  return row ?? null;
}

/** Editing a fulfilled or expired alert re-arms it; a paused alert stays paused. */
export async function updateAlert(
  db: Db,
  input: { userId: string; alertId: string; draft: AlertDraft; today: string; confirmWarnings?: boolean },
): Promise<AlertSaveResult> {
  const existing = await getOwned(db, input.userId, input.alertId);
  if (!existing) return { ok: false, errors: { form: "Alert not found." } };
  const d = cleanDraft(input.draft);
  const invalid = await validateForSave(db, d, input.today, !!input.confirmWarnings);
  if (invalid) return invalid;

  const rearm = existing.status === "fulfilled" || existing.status === "expired";
  await db.transaction(async (tx) => {
    await tx
      .update(alerts)
      .set({
        movieId: d.movieId,
        cityId: d.cityId,
        dates: normalizeDates(d.dates),
        timeStart: d.timeStart,
        timeEnd: d.timeEnd,
        mode: d.mode,
        status: rearm ? "active" : existing.status,
      })
      .where(eq(alerts.id, existing.id));
    await writeJoins(tx, existing.id, d);
    await addHistory(tx, existing.id, "edited", rearm ? "Re-armed after edit" : undefined);
  });
  return { ok: true, alertId: existing.id };
}

export type AlertAction = "pause" | "resume" | "delete";

export async function setAlertStatus(
  db: Db,
  input: { userId: string; alertId: string; action: AlertAction; today: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await getOwned(db, input.userId, input.alertId);
  if (!a) return { ok: false, error: "Alert not found." };

  if (input.action === "delete") {
    await db.update(alerts).set({ deletedAt: new Date() }).where(eq(alerts.id, a.id));
    await addHistory(db, a.id, "deleted");
    return { ok: true };
  }
  if (input.action === "pause") {
    if (a.status !== "active") return { ok: false, error: "Only active alerts can be paused." };
    await db.update(alerts).set({ status: "paused" }).where(eq(alerts.id, a.id));
    await addHistory(db, a.id, "paused");
    return { ok: true };
  }
  // resume
  if (a.status === "active") return { ok: true };
  if (a.status === "expired" || remainingDates(a.dates, input.today).length === 0) {
    return { ok: false, error: "All dates have passed. Edit the alert to add new dates." };
  }
  await db.update(alerts).set({ status: "active" }).where(eq(alerts.id, a.id));
  await addHistory(db, a.id, "resumed", a.status === "fulfilled" ? "Re-armed after a match" : undefined);
  return { ok: true };
}

async function toViews(db: Db, rows: Alert[], today: string): Promise<AlertView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [movieRows, evRows, fmtRows, thRows, plRows] = await Promise.all([
    db
      .select()
      .from(movies)
      .where(inArray(movies.id, uniq(rows.map((r) => r.movieId)))),
    db
      .select({ alertId: alertEvents.alertId, id: movieBmsEvents.id, language: movieBmsEvents.language, formatHint: movieBmsEvents.formatHint })
      .from(alertEvents)
      .innerJoin(movieBmsEvents, eq(movieBmsEvents.id, alertEvents.eventId))
      .where(inArray(alertEvents.alertId, ids))
      .orderBy(asc(movieBmsEvents.language)),
    db
      .select({ alertId: alertFormats.alertId, id: formats.id, name: formats.name, sortOrder: formats.sortOrder })
      .from(alertFormats)
      .innerJoin(formats, eq(formats.id, alertFormats.formatId))
      .where(inArray(alertFormats.alertId, ids))
      .orderBy(asc(formats.sortOrder)),
    db
      .select({ alertId: alertTheatres.alertId, id: theatres.id, name: theatres.name, areaName: places.name })
      .from(alertTheatres)
      .innerJoin(theatres, eq(theatres.id, alertTheatres.theatreId))
      .innerJoin(places, eq(places.id, theatres.placeId))
      .where(inArray(alertTheatres.alertId, ids))
      .orderBy(asc(theatres.name)),
    db
      .select({ alertId: alertPlaces.alertId, id: places.id, name: places.name })
      .from(alertPlaces)
      .innerJoin(places, eq(places.id, alertPlaces.placeId))
      .where(inArray(alertPlaces.alertId, ids))
      .orderBy(asc(places.name)),
  ]);
  const movieById = new Map(movieRows.map((m) => [m.id, m]));

  return rows.map((r) => {
    const m = movieById.get(r.movieId)!;
    const remaining = remainingDates(r.dates, today);
    const status: AlertStatus =
      (r.status === "active" || r.status === "paused") && remaining.length === 0 ? "expired" : r.status;
    return {
      id: r.id,
      status,
      mode: r.mode,
      movie: { id: m.id, title: m.title, slug: m.slug, posterPath: m.posterPath },
      cityId: r.cityId,
      dates: r.dates,
      remainingDates: remaining,
      timeStart: toHHMM(r.timeStart),
      timeEnd: toHHMM(r.timeEnd),
      events: evRows.filter((e) => e.alertId === r.id).map(({ alertId: _, ...e }) => e),
      formats: fmtRows.filter((f) => f.alertId === r.id).map(({ id, name }) => ({ id, name })),
      theatres: thRows.filter((t) => t.alertId === r.id).map(({ alertId: _, ...t }) => t),
      areas: plRows.filter((p) => p.alertId === r.id).map(({ id, name }) => ({ id, name })),
      lastMatchedAt: r.lastMatchedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

/** Open alerts first (active, paused), then the rest; newest first within each group. */
export async function listUserAlerts(db: Db, userId: string, today: string): Promise<AlertView[]> {
  const rows = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.userId, userId), isNull(alerts.deletedAt)))
    .orderBy(desc(alerts.createdAt));
  const order: Record<AlertStatus, number> = { active: 0, paused: 1, fulfilled: 2, expired: 3 };
  return (await toViews(db, rows, today)).sort((a, b) => order[a.status] - order[b.status]);
}

export async function getUserAlert(
  db: Db,
  userId: string,
  alertId: string,
  today: string,
): Promise<(AlertView & { history: { kind: AlertHistoryKind; detail: string | null; createdAt: Date }[] }) | null> {
  const a = await getOwned(db, userId, alertId);
  if (!a) return null;
  const [view] = await toViews(db, [a], today);
  const history = await db
    .select({ kind: alertHistory.kind, detail: alertHistory.detail, createdAt: alertHistory.createdAt })
    .from(alertHistory)
    .where(eq(alertHistory.alertId, a.id))
    .orderBy(desc(alertHistory.createdAt), desc(alertHistory.id));
  return { ...view!, history };
}

export function viewToDraft(v: AlertView): AlertDraft {
  return {
    cityId: v.cityId,
    movieId: v.movie.id,
    eventIds: v.events.map((e) => e.id),
    dates: v.remainingDates,
    timeStart: v.timeStart,
    timeEnd: v.timeEnd,
    formatIds: v.formats.map((f) => f.id),
    theatreIds: v.theatres.map((t) => t.id),
    areaIds: v.areas.map((a) => a.id),
    mode: v.mode,
  };
}

/** Marks active/paused alerts with no remaining dates as expired. Run by the scheduler. */
export async function expireAlerts(db: Db, today: string): Promise<number> {
  const expired = await db
    .update(alerts)
    .set({ status: "expired" })
    .where(
      and(
        isNull(alerts.deletedAt),
        inArray(alerts.status, ["active", "paused"]),
        sql`not exists (select 1 from unnest(${alerts.dates}) as d where d >= ${today}::date)`,
      ),
    )
    .returning({ id: alerts.id });
  if (expired.length) {
    await db.insert(alertHistory).values(expired.map((e) => ({ alertId: e.id, kind: "expired" as const })));
  }
  return expired.length;
}

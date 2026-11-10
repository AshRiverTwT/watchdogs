import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { type AlertDraft, ALERT_LIMITS } from "@watchdogs/core";
import type { Db } from "../index";
import { alertHistory, alerts, formats, movieBmsEvents, movies, users } from "../schema";
import { seedCatalog } from "../seed/catalog";
import { createTestDb } from "../testing";
import {
  createAlert,
  expireAlerts,
  getUserAlert,
  listUserAlerts,
  setAlertStatus,
  updateAlert,
  viewToDraft,
} from "./alerts";
import { listAreas, listCities, listTheatres } from "./catalog";

const TODAY = "2026-11-10";
let db: Db;
let close: () => Promise<void>;
let base: AlertDraft;
let ids: { cityId: string; movieId: string; teluguId: string; otherMovieEventId: string; d2: string; d3: string; sudarshan: string; amb: string; banjara: string };

async function makeUser(email: string, verified = true) {
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash: "x", emailVerifiedAt: verified ? new Date() : null })
    .returning();
  return u!.id;
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedCatalog(db);
  const [city] = await listCities(db);
  const [monsoon] = await db.select().from(movies).where(eq(movies.slug, "sample-monsoon-signal"));
  const [orbit] = await db.select().from(movies).where(eq(movies.slug, "sample-orbit-nine"));
  const evs = await db.select().from(movieBmsEvents);
  const fmts = await db.select().from(formats);
  const [sudarshan] = await listTheatres(db, { q: "Sudarshan" });
  const [amb] = await listTheatres(db, { q: "AMB" });
  const banjara = (await listAreas(db, city!.id)).find((a) => a.name === "Banjara Hills")!;
  ids = {
    cityId: city!.id,
    movieId: monsoon!.id,
    teluguId: evs.find((e) => e.movieId === monsoon!.id && e.language === "Telugu")!.id,
    otherMovieEventId: evs.find((e) => e.movieId === orbit!.id)!.id,
    d2: fmts.find((f) => f.code === "2d")!.id,
    d3: fmts.find((f) => f.code === "3d")!.id,
    sudarshan: sudarshan!.id,
    amb: amb!.id,
    banjara: banjara.id,
  };
  base = {
    cityId: ids.cityId,
    movieId: ids.movieId,
    eventIds: [ids.teluguId],
    dates: ["2026-11-15", "2026-11-14"],
    timeStart: "18:00",
    timeEnd: "22:30",
    formatIds: [ids.d2],
    theatreIds: [ids.amb],
    areaIds: [ids.banjara],
    mode: "first_match",
  };
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(alerts);
});

describe("createAlert", () => {
  it("saves an alert with its joins, sorted dates and a history entry", async () => {
    const userId = await makeUser(`a${Date.now()}@x.test`);
    const res = await createAlert(db, { userId, draft: base, today: TODAY });
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;

    const view = await getUserAlert(db, userId, res.alertId, TODAY);
    expect(view).toMatchObject({
      status: "active",
      dates: ["2026-11-14", "2026-11-15"],
      timeStart: "18:00",
      timeEnd: "22:30",
      events: [{ language: "Telugu" }],
      formats: [{ name: "2D" }],
      theatres: [{ name: "AMB Cinemas", areaName: "Gachibowli" }],
      areas: [{ name: "Banjara Hills" }],
    });
    expect(view!.history.map((h) => h.kind)).toEqual(["created"]);
  });

  it("requires a confirmed email", async () => {
    const userId = await makeUser(`u${Date.now()}@x.test`, false);
    expect(await createAlert(db, { userId, draft: base, today: TODAY })).toMatchObject({
      ok: false,
      errors: { form: expect.stringMatching(/confirm your email/i) },
    });
  });

  it("returns shape errors before touching references", async () => {
    const userId = await makeUser(`s${Date.now()}@x.test`);
    const res = await createAlert(db, { userId, draft: { ...base, timeEnd: "17:00", dates: ["2026-11-01"] }, today: TODAY });
    expect(res).toMatchObject({ ok: false, errors: { timeEnd: expect.any(String), dates: expect.any(String) } });
  });

  it("rejects a language variant that belongs to another movie", async () => {
    const userId = await makeUser(`v${Date.now()}@x.test`);
    const res = await createAlert(db, {
      userId,
      draft: { ...base, eventIds: [ids.otherMovieEventId] },
      today: TODAY,
    });
    expect(res).toMatchObject({ ok: false, errors: { eventIds: expect.any(String) } });
  });

  it("rejects unknown theatres and areas from another city", async () => {
    const userId = await makeUser(`t${Date.now()}@x.test`);
    const res = await createAlert(db, {
      userId,
      draft: { ...base, theatreIds: ["00000000-0000-0000-0000-000000000000"], areaIds: [ids.cityId] },
      today: TODAY,
    });
    expect(res).toMatchObject({ ok: false, errors: { theatreIds: expect.any(String), areaIds: expect.any(String) } });
  });

  it("warns when a theatre is not known to screen a chosen format, and saves once confirmed", async () => {
    const userId = await makeUser(`w${Date.now()}@x.test`);
    const draft = { ...base, formatIds: [ids.d3], theatreIds: [ids.sudarshan, ids.amb] };
    const first = await createAlert(db, { userId, draft, today: TODAY });
    expect(first).toEqual({
      ok: false,
      warnings: [{ theatreId: ids.sudarshan, theatreName: "Sudarshan 35mm", formatNames: ["3D"] }],
    });
    expect(await db.select().from(alerts)).toHaveLength(0);
    expect((await createAlert(db, { userId, draft, today: TODAY, confirmWarnings: true })).ok).toBe(true);
  });

  it("allows 'any' for formats, theatres, areas and languages", async () => {
    const userId = await makeUser(`any${Date.now()}@x.test`);
    const res = await createAlert(db, {
      userId,
      draft: { ...base, eventIds: [], formatIds: [], theatreIds: [], areaIds: [] },
      today: TODAY,
    });
    expect(res.ok).toBe(true);
  });

  it("caps open alerts per user", async () => {
    const userId = await makeUser(`cap${Date.now()}@x.test`);
    for (let i = 0; i < ALERT_LIMITS.maxOpenPerUser; i++) {
      expect((await createAlert(db, { userId, draft: base, today: TODAY })).ok).toBe(true);
    }
    expect(await createAlert(db, { userId, draft: base, today: TODAY })).toMatchObject({
      ok: false,
      errors: { form: expect.stringMatching(/open alerts/) },
    });
  });

  it("enforces the time window in the database too", async () => {
    const userId = await makeUser(`db${Date.now()}@x.test`);
    await expect(
      db.insert(alerts).values({
        userId,
        movieId: ids.movieId,
        cityId: ids.cityId,
        dates: ["2026-11-14"],
        timeStart: "22:00",
        timeEnd: "18:00",
      }),
    ).rejects.toThrow();
  });
});

describe("ownership, status changes and editing", () => {
  it("hides other users' alerts", async () => {
    const owner = await makeUser(`o${Date.now()}@x.test`);
    const other = await makeUser(`p${Date.now()}@x.test`);
    const res = await createAlert(db, { userId: owner, draft: base, today: TODAY });
    if (!res.ok) throw new Error("create failed");
    expect(await getUserAlert(db, other, res.alertId, TODAY)).toBeNull();
    expect(await listUserAlerts(db, other, TODAY)).toEqual([]);
    expect(await setAlertStatus(db, { userId: other, alertId: res.alertId, action: "delete", today: TODAY })).toMatchObject({
      ok: false,
    });
    expect(
      await updateAlert(db, { userId: other, alertId: res.alertId, draft: base, today: TODAY }),
    ).toMatchObject({ ok: false });
  });

  it("pauses, resumes and deletes, recording history", async () => {
    const userId = await makeUser(`s2${Date.now()}@x.test`);
    const res = await createAlert(db, { userId, draft: base, today: TODAY });
    if (!res.ok) throw new Error("create failed");
    const act = (action: "pause" | "resume" | "delete") =>
      setAlertStatus(db, { userId, alertId: res.alertId, action, today: TODAY });

    expect(await act("pause")).toEqual({ ok: true });
    expect(await act("pause")).toMatchObject({ ok: false });
    expect((await getUserAlert(db, userId, res.alertId, TODAY))!.status).toBe("paused");
    expect(await act("resume")).toEqual({ ok: true });
    expect(await act("delete")).toEqual({ ok: true });

    expect(await getUserAlert(db, userId, res.alertId, TODAY)).toBeNull();
    expect(await listUserAlerts(db, userId, TODAY)).toEqual([]);
    const kinds = (await db.select().from(alertHistory).where(eq(alertHistory.alertId, res.alertId))).map((h) => h.kind);
    expect(kinds.sort()).toEqual(["created", "deleted", "paused", "resumed"]);
  });

  it("re-arms a fulfilled alert on resume only while dates remain", async () => {
    const userId = await makeUser(`f${Date.now()}@x.test`);
    const res = await createAlert(db, { userId, draft: base, today: TODAY });
    if (!res.ok) throw new Error("create failed");
    await db.update(alerts).set({ status: "fulfilled" }).where(eq(alerts.id, res.alertId));

    expect(await setAlertStatus(db, { userId, alertId: res.alertId, action: "resume", today: "2026-11-16" })).toMatchObject({
      ok: false,
    });
    expect(await setAlertStatus(db, { userId, alertId: res.alertId, action: "resume", today: TODAY })).toEqual({ ok: true });
  });

  it("edits replace joins; editing a fulfilled alert re-arms it, a paused one stays paused", async () => {
    const userId = await makeUser(`e${Date.now()}@x.test`);
    const res = await createAlert(db, { userId, draft: base, today: TODAY });
    if (!res.ok) throw new Error("create failed");

    await db.update(alerts).set({ status: "fulfilled" }).where(eq(alerts.id, res.alertId));
    const draft = { ...base, formatIds: [], theatreIds: [], areaIds: [ids.banjara], dates: ["2026-11-20"], mode: "keep_watching" as const };
    expect(await updateAlert(db, { userId, alertId: res.alertId, draft, today: TODAY })).toEqual({ ok: true, alertId: res.alertId });

    let view = await getUserAlert(db, userId, res.alertId, TODAY);
    expect(view).toMatchObject({ status: "active", formats: [], theatres: [], dates: ["2026-11-20"], mode: "keep_watching" });
    expect(view!.history[0]).toMatchObject({ kind: "edited", detail: "Re-armed after edit" });
    expect(viewToDraft(view!)).toEqual({ ...draft });

    await setAlertStatus(db, { userId, alertId: res.alertId, action: "pause", today: TODAY });
    await updateAlert(db, { userId, alertId: res.alertId, draft: base, today: TODAY });
    view = await getUserAlert(db, userId, res.alertId, TODAY);
    expect(view!.status).toBe("paused");
  });
});

describe("expiry", () => {
  it("expires alerts once every date has passed, and shows them as expired before that runs", async () => {
    const userId = await makeUser(`x${Date.now()}@x.test`);
    const res = await createAlert(db, { userId, draft: base, today: TODAY });
    if (!res.ok) throw new Error("create failed");

    expect(await expireAlerts(db, "2026-11-15")).toBe(0);
    expect((await listUserAlerts(db, userId, "2026-11-16"))[0]!.status).toBe("expired");

    expect(await expireAlerts(db, "2026-11-16")).toBe(1);
    const [row] = await db.select().from(alerts).where(eq(alerts.id, res.alertId));
    expect(row!.status).toBe("expired");
    expect(await expireAlerts(db, "2026-11-16")).toBe(0);
  });
});

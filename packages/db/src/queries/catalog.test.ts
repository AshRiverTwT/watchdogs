import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "../index";
import { formats, movies, places, theatres } from "../schema";
import { seedCatalog } from "../seed/catalog";
import { AREAS, FORMATS, SAMPLE_MOVIES, THEATRES } from "../seed/data";
import { createTestDb } from "../testing";
import {
  getMovieBySlug,
  listAreas,
  listCities,
  listFormats,
  listMovies,
  listTheatres,
  unsupportedFormats,
} from "./catalog";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedCatalog(db);
});
afterAll(() => close());

const formatId = async (code: string) => (await db.select().from(formats).where(eq(formats.code, code)))[0]!.id;

describe("seedCatalog", () => {
  it("is idempotent and does not overwrite admin edits", async () => {
    await db.update(formats).set({ name: "Two-D (edited)" }).where(eq(formats.code, "2d"));
    const counts = await seedCatalog(db);
    expect(counts).toEqual({
      formats: FORMATS.length,
      places: 1 + AREAS.length,
      theatres: THEATRES.length,
      movies: SAMPLE_MOVIES.length,
    });
    const [f] = await db.select().from(formats).where(eq(formats.code, "2d"));
    expect(f!.name).toBe("Two-D (edited)");
    await db.update(formats).set({ name: "2D" }).where(eq(formats.code, "2d"));
  });

  it("seeds Hyderabad with region code HYD", async () => {
    const [city] = await listCities(db);
    expect(city).toMatchObject({ name: "Hyderabad", bmsRegionCode: "HYD", kind: "city", parentId: null });
  });

  it("rejects an area without a parent (check constraint)", async () => {
    await expect(db.insert(places).values({ kind: "area", name: "Orphan", slug: "orphan" })).rejects.toThrow();
  });
});

describe("catalog queries", () => {
  it("lists active formats in sort order and hides inactive ones", async () => {
    expect((await listFormats(db)).map((f) => f.code)).toEqual(FORMATS.map((f) => f.code));
    await db.update(formats).set({ active: false }).where(eq(formats.code, "pcx"));
    expect((await listFormats(db)).map((f) => f.code)).not.toContain("pcx");
    expect((await listFormats(db, { includeInactive: true })).map((f) => f.code)).toContain("pcx");
    await db.update(formats).set({ active: true }).where(eq(formats.code, "pcx"));
  });

  it("lists areas of a city alphabetically", async () => {
    const [city] = await listCities(db);
    const areas = await listAreas(db, city!.id);
    expect(areas.map((a) => a.name)).toEqual([...AREAS].sort((a, b) => a.localeCompare(b)));
  });

  it("filters theatres by city, area, format and search text", async () => {
    const [city] = await listCities(db);
    expect(await listTheatres(db, { cityId: city!.id })).toHaveLength(THEATRES.length);

    const banjara = (await listAreas(db, city!.id)).find((a) => a.name === "Banjara Hills")!;
    const inBanjara = await listTheatres(db, { areaId: banjara.id });
    expect(inBanjara.map((t) => t.name).sort()).toEqual(["INOX GVK One", "PVR RK Cineplex"]);
    expect(inBanjara[0]!.area.name).toBe("Banjara Hills");

    const threeD = await listTheatres(db, { formatId: await formatId("3d") });
    expect(threeD.map((t) => t.name)).not.toContain("Sudarshan 35mm");

    expect((await listTheatres(db, { q: "rtc x" })).map((t) => t.name).sort()).toEqual([
      "Sandhya 70mm",
      "Sudarshan 35mm",
    ]);
    expect(await listTheatres(db, { q: "100%_" })).toEqual([]);
    expect(await listTheatres(db, { ids: [] })).toEqual([]);
  });

  it("hides inactive theatres unless asked", async () => {
    await db.update(theatres).set({ active: false }).where(eq(theatres.name, "AAA Cinemas"));
    expect((await listTheatres(db)).map((t) => t.name)).not.toContain("AAA Cinemas");
    expect((await listTheatres(db, { includeInactive: true })).map((t) => t.name)).toContain("AAA Cinemas");
    await db.update(theatres).set({ active: true }).where(eq(theatres.name, "AAA Cinemas"));
  });

  it("lists movies with their BMS event codes and filters by status and title", async () => {
    const all = await listMovies(db);
    expect(all).toHaveLength(SAMPLE_MOVIES.length);
    const monsoon = all.find((m) => m.title.includes("Monsoon"))!;
    expect(monsoon.events.map((e) => e.language)).toEqual(["Hindi", "Telugu"]);

    expect((await listMovies(db, { status: ["now_showing"] })).map((m) => m.title)).toEqual([monsoon.title]);
    expect((await listMovies(db, { q: "orbit" })).map((m) => m.slug)).toEqual(["sample-orbit-nine"]);
  });

  it("gets a movie by slug, and not when inactive", async () => {
    expect((await getMovieBySlug(db, "sample-orbit-nine"))?.events[0]?.eventCode).toBe("ET90000003");
    await db.update(movies).set({ active: false }).where(eq(movies.slug, "sample-orbit-nine"));
    expect(await getMovieBySlug(db, "sample-orbit-nine")).toBeNull();
    await db.update(movies).set({ active: true }).where(eq(movies.slug, "sample-orbit-nine"));
  });

  it("reports formats a chosen theatre is not known to screen", async () => {
    const [sudarshan] = await listTheatres(db, { q: "Sudarshan" });
    const [amb] = await listTheatres(db, { q: "AMB" });
    const twoD = await formatId("2d");
    const threeD = await formatId("3d");
    const res = await unsupportedFormats(db, [sudarshan!.id, amb!.id], [twoD, threeD]);
    expect(res).toEqual([{ theatreId: sudarshan!.id, formatIds: [threeD] }]);
    expect(await unsupportedFormats(db, [amb!.id], [])).toEqual([]);
  });
});

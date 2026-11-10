import { describe, expect, it } from "vitest";
import {
  type AlertDraft,
  ALERT_LIMITS,
  addDays,
  expandDateRange,
  istNowHHMM,
  istToday,
  isValidDate,
  normalizeDates,
  summarizeDates,
  validateAlertDraft,
} from "./alerts";

const TODAY = "2026-11-10";
const draft = (over: Partial<AlertDraft> = {}): AlertDraft => ({
  cityId: "c",
  movieId: "m",
  eventIds: [],
  dates: ["2026-11-14", "2026-11-15"],
  timeStart: "18:00",
  timeEnd: "22:00",
  formatIds: [],
  theatreIds: [],
  areaIds: [],
  mode: "first_match",
  ...over,
});

describe("IST dates", () => {
  it("rolls over at 18:30 UTC", () => {
    expect(istToday(new Date("2026-11-10T18:29:00Z"))).toBe("2026-11-10");
    expect(istToday(new Date("2026-11-10T18:30:00Z"))).toBe("2026-11-11");
    expect(istNowHHMM(new Date("2026-11-10T18:30:00Z"))).toBe("00:00");
  });

  it("validates calendar dates", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("14-11-2026")).toBe(false);
  });

  it("expands ranges across month ends, inclusive", () => {
    expect(expandDateRange("2026-11-29", "2026-12-02")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    expect(expandDateRange("2026-11-15", "2026-11-14")).toEqual([]);
    expect(expandDateRange("2026-01-01", "2026-12-31")).toHaveLength(ALERT_LIMITS.maxDates + 1);
  });

  it("normalizes date lists", () => {
    expect(normalizeDates(["2026-11-15", "2026-11-14", "2026-11-15", "nope"])).toEqual(["2026-11-14", "2026-11-15"]);
  });

  it("summarizes date lists", () => {
    expect(summarizeDates(["2026-11-14"])).toBe("Sat 14 Nov");
    expect(summarizeDates(["2026-11-14", "2026-11-15", "2026-11-16"])).toBe("Sat 14 Nov – Mon 16 Nov");
    expect(summarizeDates(["2026-11-14", "2026-11-20", "2026-11-22", "2026-11-25"])).toBe(
      "Sat 14 Nov, Fri 20 Nov +2 more",
    );
  });
});

describe("validateAlertDraft", () => {
  it("accepts a normal alert", () => {
    expect(validateAlertDraft(draft(), TODAY)).toEqual({});
  });

  it("accepts today but not yesterday", () => {
    expect(validateAlertDraft(draft({ dates: [TODAY] }), TODAY)).toEqual({});
    expect(validateAlertDraft(draft({ dates: ["2026-11-09", TODAY] }), TODAY).dates).toMatch(/today or later/);
  });

  it("limits how far ahead and how many dates", () => {
    expect(validateAlertDraft(draft({ dates: [addDays(TODAY, ALERT_LIMITS.maxDaysAhead)] }), TODAY)).toEqual({});
    expect(validateAlertDraft(draft({ dates: [addDays(TODAY, ALERT_LIMITS.maxDaysAhead + 1)] }), TODAY).dates).toMatch(
      /days ahead/,
    );
    const many = expandDateRange(TODAY, addDays(TODAY, ALERT_LIMITS.maxDates));
    expect(validateAlertDraft(draft({ dates: many }), TODAY).dates).toMatch(/at most/);
  });

  it("rejects empty, duplicate and malformed dates", () => {
    expect(validateAlertDraft(draft({ dates: [] }), TODAY).dates).toBeDefined();
    expect(validateAlertDraft(draft({ dates: ["2026-11-14", "2026-11-14"] }), TODAY).dates).toBeDefined();
    expect(validateAlertDraft(draft({ dates: ["2026-11-31"] }), TODAY).dates).toBeDefined();
  });

  it("requires start before end, down to the minute", () => {
    expect(validateAlertDraft(draft({ timeStart: "21:59", timeEnd: "22:00" }), TODAY)).toEqual({});
    expect(validateAlertDraft(draft({ timeStart: "22:00", timeEnd: "22:00" }), TODAY).timeEnd).toMatch(/after/);
    expect(validateAlertDraft(draft({ timeStart: "23:00", timeEnd: "01:00" }), TODAY).timeEnd).toMatch(/after/);
    expect(validateAlertDraft(draft({ timeStart: "00:00", timeEnd: "23:59" }), TODAY)).toEqual({});
    expect(validateAlertDraft(draft({ timeStart: "7pm" }), TODAY).timeStart).toBeDefined();
  });

  it("requires a movie and a valid mode, and caps theatres", () => {
    expect(validateAlertDraft(draft({ movieId: "" }), TODAY).movieId).toBeDefined();
    expect(validateAlertDraft(draft({ mode: "sometimes" as never }), TODAY).mode).toBeDefined();
    const ids = Array.from({ length: ALERT_LIMITS.maxTheatres + 1 }, (_, i) => `t${i}`);
    expect(validateAlertDraft(draft({ theatreIds: ids }), TODAY).theatreIds).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import { isWithinWindow, parseHHMM } from "./time";

describe("parseHHMM", () => {
  it("parses valid times", () => {
    expect(parseHHMM("00:00")).toBe(0);
    expect(parseHHMM("23:59")).toBe(1439);
  });
  it("rejects invalid times", () => {
    expect(() => parseHHMM("24:00")).toThrow();
    expect(() => parseHHMM("9:30")).toThrow();
  });
});

describe("isWithinWindow", () => {
  it("includes both edge minutes", () => {
    expect(isWithinWindow("18:00", "18:00", "21:00")).toBe(true);
    expect(isWithinWindow("21:00", "18:00", "21:00")).toBe(true);
  });
  it("excludes the minute either side", () => {
    expect(isWithinWindow("17:59", "18:00", "21:00")).toBe(false);
    expect(isWithinWindow("21:01", "18:00", "21:00")).toBe(false);
  });
  it("rejects inverted windows", () => {
    expect(() => isWithinWindow("12:00", "21:00", "18:00")).toThrow();
  });
});

import { parseHHMM } from "./time";

export const ALERT_LIMITS = {
  /** Distinct show dates one alert can watch. */
  maxDates: 31,
  /** How far ahead a date can be, counted from today in IST. */
  maxDaysAhead: 120,
  maxTheatres: 25,
  maxAreas: 15,
  /** Alerts per user that are not deleted, expired or fulfilled. */
  maxOpenPerUser: 10,
} as const;

export type AlertMode = "first_match" | "keep_watching";
export const ALERT_MODES: readonly AlertMode[] = ["first_match", "keep_watching"];

export interface AlertDraft {
  cityId: string;
  movieId: string;
  /** Specific BMS variants (language/format). Empty means any variant of the movie. */
  eventIds: string[];
  /** YYYY-MM-DD, IST calendar dates. */
  dates: string[];
  /** HH:MM, inclusive. */
  timeStart: string;
  timeEnd: string;
  /** Empty means any format. */
  formatIds: string[];
  /** Empty theatres and empty areas mean anywhere in the city. */
  theatreIds: string[];
  areaIds: string[];
  mode: AlertMode;
}

export type AlertField = keyof AlertDraft | "form";
export type AlertErrors = Partial<Record<AlertField, string>>;

const IST_OFFSET_MS = 330 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in India (UTC+5:30, no DST). */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Current wall-clock time in India as HH:MM. */
export function istNowHHMM(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Inclusive; returns [] for an inverted range. Capped to avoid runaway input. */
export function expandDateRange(from: string, to: string, cap: number = ALERT_LIMITS.maxDates + 1): string[] {
  if (!isValidDate(from) || !isValidDate(to) || to < from) return [];
  const out: string[] = [];
  for (let d = from; d <= to && out.length < cap; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Sorted, de-duplicated, invalid entries dropped. */
export function normalizeDates(dates: string[]): string[] {
  return [...new Set(dates.map((d) => d.trim()).filter(isValidDate))].sort();
}

/** "18:00:00" (Postgres time) or "18:00" -> "18:00" */
export function toHHMM(value: string): string {
  return value.slice(0, 5);
}

/**
 * Checks the shape of an alert. Whether the referenced movie, theatres etc. exist
 * is checked against the database by the alert service.
 */
export function validateAlertDraft(draft: AlertDraft, today: string): AlertErrors {
  const errors: AlertErrors = {};

  if (!draft.movieId) errors.movieId = "Choose a movie.";

  const dates = normalizeDates(draft.dates);
  if (dates.length !== draft.dates.length) {
    errors.dates = "Some dates are not valid or appear twice.";
  } else if (dates.length === 0) {
    errors.dates = "Add at least one date.";
  } else if (dates.length > ALERT_LIMITS.maxDates) {
    errors.dates = `Pick at most ${ALERT_LIMITS.maxDates} dates.`;
  } else if (dates[0]! < today) {
    errors.dates = "Dates must be today or later.";
  } else if (daysBetween(today, dates.at(-1)!) > ALERT_LIMITS.maxDaysAhead) {
    errors.dates = `Dates can be at most ${ALERT_LIMITS.maxDaysAhead} days ahead.`;
  }

  let start: number | undefined;
  let end: number | undefined;
  try {
    start = parseHHMM(draft.timeStart);
  } catch {
    errors.timeStart = "Enter a start time like 18:00.";
  }
  try {
    end = parseHHMM(draft.timeEnd);
  } catch {
    errors.timeEnd = "Enter an end time like 22:30.";
  }
  if (start !== undefined && end !== undefined && start >= end) {
    errors.timeEnd = "End time must be after start time.";
  }

  if (draft.theatreIds.length > ALERT_LIMITS.maxTheatres) {
    errors.theatreIds = `Pick at most ${ALERT_LIMITS.maxTheatres} theatres.`;
  }
  if (draft.areaIds.length > ALERT_LIMITS.maxAreas) {
    errors.areaIds = `Pick at most ${ALERT_LIMITS.maxAreas} areas.`;
  }
  if (!ALERT_MODES.includes(draft.mode)) errors.mode = "Choose when to stop.";

  return errors;
}

/** Dates still to come (today counts). */
export function remainingDates(dates: string[], today: string): string[] {
  return dates.filter((d) => d >= today);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-14" -> "Sat 14 Nov"; locale-independent so server and client agree. */
export function formatDateShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Compact human summary: "Fri 14 Nov – Sun 16 Nov" or "Fri 14 Nov, Sat 22 Nov +2 more". */
export function summarizeDates(dates: string[]): string {
  const sorted = normalizeDates(dates);
  if (sorted.length === 0) return "No dates";
  const fmt = formatDateShort;
  const contiguous = sorted.every((d, i) => i === 0 || daysBetween(sorted[i - 1]!, d) === 1);
  if (sorted.length === 1) return fmt(sorted[0]!);
  if (contiguous) return `${fmt(sorted[0]!)} – ${fmt(sorted.at(-1)!)}`;
  const shown = sorted.slice(0, 2).map(fmt).join(", ");
  return sorted.length > 2 ? `${shown} +${sorted.length - 2} more` : shown;
}

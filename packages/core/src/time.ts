/** All show times are IST wall-clock values stored as "HH:MM". */
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(value: string): number {
  const m = HHMM.exec(value);
  if (!m) throw new Error(`Invalid time "${value}", expected HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Inclusive on both ends: a 18:00-21:00 window matches 18:00 and 21:00. */
export function isWithinWindow(time: string, start: string, end: string): boolean {
  const t = parseHHMM(time);
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s > e) throw new Error(`Window start ${start} is after end ${end}`);
  return t >= s && t <= e;
}

"use client";

import Link from "next/link";
import { type FormEvent, startTransition, useActionState, useId, useMemo, useState } from "react";
import { type AlertDraft, type AlertField, expandDateRange, formatDateShort, normalizeDates } from "@watchdogs/core";
import { saveAlertAction } from "@/app/actions/alerts";
import type { AlertFormData } from "@/lib/server/alert-form-data";

const pill =
  "inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors has-[:checked]:border-lime has-[:checked]:bg-lime has-[:checked]:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime border-paper/30 hover:border-paper";
const inputCls = "h-12 border border-paper/30 bg-transparent px-4 text-paper focus:border-lime [color-scheme:dark]";
const legendCls = "font-display text-2xl font-bold uppercase";

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-3 border-l-4 border-alert pl-3 text-sm">
      {message}
    </p>
  );
}

export function AlertForm({
  data,
  initial,
  alertId,
}: {
  data: AlertFormData;
  initial?: AlertDraft;
  alertId?: string;
}) {
  const [state, dispatch, pending] = useActionState(saveAlertAction, undefined);
  const uid = useId();
  const errId = (f: AlertField) => `${uid}-${f}-error`;
  const err = (f: AlertField) => state?.errors?.[f];

  const [movieId, setMovieId] = useState(initial?.movieId ?? "");
  const [eventIds, setEventIds] = useState<string[]>(initial?.eventIds ?? []);
  const [dates, setDates] = useState<string[]>(initial?.dates ?? []);
  const [timeStart, setTimeStart] = useState(initial?.timeStart ?? "18:00");
  const [timeEnd, setTimeEnd] = useState(initial?.timeEnd ?? "23:59");
  const [formatIds, setFormatIds] = useState<string[]>(initial?.formatIds ?? []);
  const [theatreIds, setTheatreIds] = useState<string[]>(initial?.theatreIds ?? []);
  const [areaIds, setAreaIds] = useState<string[]>(initial?.areaIds ?? []);
  const [mode, setMode] = useState(initial?.mode ?? "first_match");
  const [single, setSingle] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [theatreQuery, setTheatreQuery] = useState("");
  const [submittedKey, setSubmittedKey] = useState("");

  const draft: AlertDraft = {
    cityId: data.city.id,
    movieId,
    eventIds,
    dates,
    timeStart,
    timeEnd,
    formatIds,
    theatreIds,
    areaIds,
    mode,
  };
  const draftKey = JSON.stringify(draft);
  // Server warnings only apply to the exact picks they were computed for.
  const serverWarnings = submittedKey === draftKey ? state?.warnings : undefined;

  /**
   * Submit from React state, not the DOM. React 19 resets a form's DOM after an
   * `action` prop runs, which would desync controlled checkboxes and selects.
   */
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (alertId) fd.set("alertId", alertId);
    for (const [key, value] of Object.entries(draft)) {
      if (Array.isArray(value)) for (const v of value) fd.append(key, v);
      else fd.set(key, value);
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name === "confirm") fd.set("confirm", "1");
    setSubmittedKey(draftKey);
    startTransition(() => dispatch(fd));
  };

  const movie = data.movies.find((m) => m.id === movieId);
  const nowShowing = data.movies.filter((m) => m.status === "now_showing");
  const upcoming = data.movies.filter((m) => m.status === "upcoming");

  const addDates = (more: string[]) => {
    const valid = more.filter((d) => d >= data.today && d <= data.maxDate);
    setDates((cur) => normalizeDates([...cur, ...valid]).slice(0, data.limits.maxDates));
  };

  const grouped = useMemo(() => {
    const q = theatreQuery.trim().toLowerCase();
    return data.areas
      .map((area) => ({
        area,
        theatres: data.theatres.filter(
          (t) => t.areaId === area.id && (!q || t.name.toLowerCase().includes(q) || area.name.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => !q || g.theatres.length > 0 || g.area.name.toLowerCase().includes(q));
  }, [data.areas, data.theatres, theatreQuery]);

  const formatName = (id: string) => data.formats.find((f) => f.id === id)?.name ?? "";
  const localWarnings = formatIds.length
    ? data.theatres
        .filter((t) => theatreIds.includes(t.id))
        .map((t) => ({ name: t.name, missing: formatIds.filter((f) => !t.formatIds.includes(f)).map(formatName) }))
        .filter((w) => w.missing.length)
    : [];

  const whereSummary =
    theatreIds.length === 0 && areaIds.length === 0
      ? `Anywhere in ${data.city.name}`
      : [
          areaIds.length ? `${areaIds.length} area${areaIds.length > 1 ? "s" : ""}` : "",
          theatreIds.length ? `${theatreIds.length} theatre${theatreIds.length > 1 ? "s" : ""}` : "",
        ]
          .filter(Boolean)
          .join(" + ");

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-12" noValidate aria-busy={pending}>

      {err("form") && (
        <p role="alert" className="border-l-4 border-alert bg-alert/10 px-4 py-3">
          {err("form")}
        </p>
      )}

      {/* Movie */}
      <fieldset>
        <legend className={legendCls}>Movie</legend>
        <label htmlFor={`${uid}-movie`} className="sr-only">
          Movie
        </label>
        <select
          id={`${uid}-movie`}
          name="movieId"
          value={movieId}
          onChange={(e) => {
            setMovieId(e.target.value);
            setEventIds([]);
          }}
          aria-invalid={!!err("movieId")}
          aria-describedby={err("movieId") ? errId("movieId") : undefined}
          className={`${inputCls} mt-4 w-full`}
        >
          <option value="">Choose a movie…</option>
          {nowShowing.length > 0 && (
            <optgroup label="Now showing">
              {nowShowing.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </optgroup>
          )}
          {upcoming.length > 0 && (
            <optgroup label="Coming soon">
              {upcoming.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <FieldError id={errId("movieId")} message={err("movieId")} />

        {movie && movie.variants.length > 1 && (
          <fieldset className="mt-6">
            <legend className="text-sm font-medium uppercase tracking-wider text-paper/80">
              Language <span className="normal-case tracking-normal text-paper/60">(none picked = any)</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {movie.variants.map((v) => (
                <label key={v.id} className={pill}>
                  <input
                    type="checkbox"
                    name="eventIds"
                    value={v.id}
                    checked={eventIds.includes(v.id)}
                    onChange={() => setEventIds((c) => toggle(c, v.id))}
                    className="sr-only"
                  />
                  {v.label}
                </label>
              ))}
            </div>
            <FieldError id={errId("eventIds")} message={err("eventIds")} />
          </fieldset>
        )}
      </fieldset>

      {/* Dates */}
      <fieldset aria-describedby={err("dates") ? errId("dates") : undefined}>
        <legend className={legendCls}>Dates</legend>
        <p className="mt-2 text-paper/70">
          Add single days or a range, up to {data.limits.maxDates} days.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-2 text-sm uppercase tracking-wider text-paper/80">
              Day
              <input
                type="date"
                min={data.today}
                max={data.maxDate}
                value={single}
                onChange={(e) => setSingle(e.target.value)}
                className={inputCls}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (single) addDates([single]);
                setSingle("");
              }}
              className="h-12 border border-paper/40 px-4 text-sm font-bold uppercase hover:border-lime hover:text-lime"
            >
              Add day
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-2 text-sm uppercase tracking-wider text-paper/80">
              From
              <input
                type="date"
                min={data.today}
                max={data.maxDate}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm uppercase tracking-wider text-paper/80">
              To
              <input
                type="date"
                min={rangeFrom || data.today}
                max={data.maxDate}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className={inputCls}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                addDates(expandDateRange(rangeFrom, rangeTo || rangeFrom));
                setRangeFrom("");
                setRangeTo("");
              }}
              className="h-12 border border-paper/40 px-4 text-sm font-bold uppercase hover:border-lime hover:text-lime"
            >
              Add range
            </button>
          </div>
        </div>
        <ul aria-label="Chosen dates" className="mt-5 flex flex-wrap gap-2">
          {dates.length === 0 && <li className="text-paper/60">No dates yet.</li>}
          {dates.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full bg-paper py-1 pl-4 pr-1 text-sm text-ink">
              {formatDateShort(d)}
              <button
                type="button"
                onClick={() => setDates((c) => c.filter((x) => x !== d))}
                aria-label={`Remove ${formatDateShort(d)}`}
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-alert hover:text-paper"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {dates.length > 1 && (
          <button type="button" onClick={() => setDates([])} className="mt-3 text-sm text-paper/70 underline underline-offset-4">
            Clear all dates
          </button>
        )}
        <FieldError id={errId("dates")} message={err("dates")} />
      </fieldset>

      {/* Time */}
      <fieldset>
        <legend className={legendCls}>Show time</legend>
        <p className="mt-2 text-paper/70">Shows starting inside this window (IST), both ends included.</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-2 text-sm uppercase tracking-wider text-paper/80">
            From
            <input
              type="time"
              name="timeStart"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              aria-invalid={!!err("timeStart")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm uppercase tracking-wider text-paper/80">
            To
            <input
              type="time"
              name="timeEnd"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              aria-invalid={!!err("timeEnd")}
              aria-describedby={err("timeEnd") ? errId("timeEnd") : undefined}
              className={inputCls}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              ["Any time", "00:00", "23:59"],
              ["Morning", "06:00", "12:00"],
              ["Afternoon", "12:00", "17:00"],
              ["Evening", "17:00", "23:59"],
            ].map(([label, s, e]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setTimeStart(s!);
                  setTimeEnd(e!);
                }}
                aria-pressed={timeStart === s && timeEnd === e}
                className="rounded-full border border-paper/30 px-4 py-2 text-sm hover:border-paper aria-pressed:border-lime aria-pressed:text-lime"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <FieldError id={errId("timeStart")} message={err("timeStart")} />
        <FieldError id={errId("timeEnd")} message={err("timeEnd")} />
      </fieldset>

      {/* Format */}
      <fieldset>
        <legend className={legendCls}>Format</legend>
        <p className="mt-2 text-paper/70">None picked means any format.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.formats.map((f) => (
            <label key={f.id} className={pill}>
              <input
                type="checkbox"
                name="formatIds"
                value={f.id}
                checked={formatIds.includes(f.id)}
                onChange={() => setFormatIds((c) => toggle(c, f.id))}
                className="sr-only"
              />
              {f.name}
            </label>
          ))}
        </div>
        <FieldError id={errId("formatIds")} message={err("formatIds")} />
      </fieldset>

      {/* Where */}
      <fieldset>
        <legend className={legendCls}>Where</legend>
        <p className="mt-2 text-paper/70">
          Pick whole areas, single theatres, or both. <strong className="text-paper">{whereSummary}</strong>
        </p>
        <label htmlFor={`${uid}-tq`} className="mt-4 block text-sm uppercase tracking-wider text-paper/80">
          Filter theatres
        </label>
        <input
          id={`${uid}-tq`}
          type="search"
          value={theatreQuery}
          onChange={(e) => setTheatreQuery(e.target.value)}
          placeholder="Theatre or area name"
          className={`${inputCls} mt-2 w-full`}
        />
        <div className="mt-4 max-h-[28rem] overflow-y-auto border border-paper/15">
          {grouped.map(({ area, theatres }) => {
            const areaOn = areaIds.includes(area.id);
            return (
              <div key={area.id} className="border-b border-paper/10 px-4 py-3 last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    name="areaIds"
                    value={area.id}
                    checked={areaOn}
                    onChange={() => {
                      if (!areaOn) {
                        const inArea = new Set(data.theatres.filter((t) => t.areaId === area.id).map((t) => t.id));
                        setTheatreIds((c) => c.filter((id) => !inArea.has(id)));
                      }
                      setAreaIds((c) => toggle(c, area.id));
                    }}
                    className="h-5 w-5 accent-lime"
                  />
                  {area.name}
                  <span className="text-sm font-normal text-paper/50">
                    {theatres.length ? `all ${theatres.length} theatre${theatres.length > 1 ? "s" : ""}` : "whole area"}
                  </span>
                </label>
                {theatres.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2 pl-8">
                    {theatres.map((t) => (
                      <li key={t.id}>
                        <label className={`flex cursor-pointer items-center gap-3 ${areaOn ? "text-paper/50" : ""}`}>
                          <input
                            type="checkbox"
                            name="theatreIds"
                            value={t.id}
                            checked={areaOn || theatreIds.includes(t.id)}
                            disabled={areaOn}
                            onChange={() => setTheatreIds((c) => toggle(c, t.id))}
                            className="h-5 w-5 accent-lime"
                          />
                          {t.name}
                          {areaOn && <span className="sr-only">(included with the area)</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {grouped.length === 0 && <p className="px-4 py-3 text-paper/60">No theatre or area matches.</p>}
        </div>
        <FieldError id={errId("theatreIds")} message={err("theatreIds")} />
        <FieldError id={errId("areaIds")} message={err("areaIds")} />
        {localWarnings.length > 0 && !serverWarnings && (
          <div role="status" className="mt-4 border-l-4 border-electric bg-electric/15 px-4 py-3 text-sm">
            <p className="font-medium">Heads up: as far as we know,</p>
            <ul className="mt-1 list-disc pl-5">
              {localWarnings.map((w) => (
                <li key={w.name}>
                  {w.name} does not screen {w.missing.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </fieldset>

      {/* Mode */}
      <fieldset>
        <legend className={legendCls}>When to stop</legend>
        <div className="mt-4 flex flex-col gap-3">
          {[
            ["first_match", "Email me once, then stop", "Best when you just need to know booking has opened."],
            ["keep_watching", "Keep watching", "One email for each new matching show until the dates pass."],
          ].map(([value, label, hint]) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 border border-paper/20 p-4 has-[:checked]:border-lime has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime"
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value as AlertDraft["mode"])}
                className="mt-1 h-5 w-5 accent-lime"
              />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-paper/60">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {serverWarnings && serverWarnings.length > 0 && (
        <div role="alert" className="border-l-4 border-electric bg-electric/15 px-4 py-4">
          <p className="font-medium">Some theatres are not known to screen the formats you picked:</p>
          <ul className="mt-2 list-disc pl-5">
            {serverWarnings.map((w) => (
              <li key={w.theatreId}>
                {w.theatreName}: {w.formatNames.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-paper/70">
            Our theatre list may be out of date. Save anyway to watch them too, or change your picks.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-paper/15 pt-8">
        <button
          type="submit"
          name={serverWarnings?.length ? "confirm" : undefined}
          disabled={pending}
          className="cut h-12 bg-lime px-7 font-display font-bold italic uppercase tracking-wide text-ink hover:bg-paper disabled:opacity-60"
        >
          {pending ? "Saving…" : serverWarnings?.length ? "Save anyway" : alertId ? "Save changes" : "Create alert"}
        </button>
        <Link href={alertId ? `/alerts/${alertId}` : "/alerts"} className="text-paper/70 underline underline-offset-4">
          Cancel
        </Link>
      </div>
    </form>
  );
}

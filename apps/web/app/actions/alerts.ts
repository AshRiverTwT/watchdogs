"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type AlertDraft, type AlertErrors, type AlertMode, istToday } from "@watchdogs/core";
import { type AlertAction, type FormatWarning, createAlert, setAlertStatus, updateAlert } from "@watchdogs/db";
import { getSession } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { isUuid } from "@/lib/server/http";

export type AlertFormState =
  | {
      errors?: AlertErrors;
      warnings?: FormatWarning[];
      /** Echo of the submitted draft so the form keeps the user's input. */
      draft?: AlertDraft;
    }
  | undefined;

const all = (f: FormData, k: string) => f.getAll(k).map(String).filter(Boolean);
const one = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function parseDraft(f: FormData): AlertDraft {
  return {
    cityId: one(f, "cityId"),
    movieId: one(f, "movieId"),
    eventIds: all(f, "eventIds"),
    dates: all(f, "dates"),
    timeStart: one(f, "timeStart"),
    timeEnd: one(f, "timeEnd"),
    formatIds: all(f, "formatIds"),
    theatreIds: all(f, "theatreIds"),
    areaIds: all(f, "areaIds"),
    mode: (one(f, "mode") || "first_match") as AlertMode,
  };
}

/** Ids go into SQL `in (...)` lists and uuid columns; reject anything that is not a uuid up front. */
function badIds(d: AlertDraft): AlertErrors {
  const errors: AlertErrors = {};
  if (!isUuid(d.cityId)) errors.cityId = "Choose a city.";
  if (d.movieId && !isUuid(d.movieId)) errors.movieId = "Choose a movie.";
  if (!d.eventIds.every(isUuid)) errors.eventIds = "Pick languages from the list.";
  if (!d.formatIds.every(isUuid)) errors.formatIds = "Pick formats from the list.";
  if (!d.theatreIds.every(isUuid)) errors.theatreIds = "Pick theatres from the list.";
  if (!d.areaIds.every(isUuid)) errors.areaIds = "Pick areas from the list.";
  return errors;
}

export async function saveAlertAction(_: AlertFormState, form: FormData): Promise<AlertFormState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/alerts/new");

  const draft = parseDraft(form);
  const idErrors = badIds(draft);
  if (Object.keys(idErrors).length) return { errors: idErrors, draft };

  const alertId = one(form, "alertId");
  if (alertId && !isUuid(alertId)) return { errors: { form: "Alert not found." }, draft };

  const db = await getDb();
  const input = {
    userId: session.user.id,
    draft,
    today: istToday(),
    confirmWarnings: form.get("confirm") === "1",
  };
  const res = alertId ? await updateAlert(db, { ...input, alertId }) : await createAlert(db, input);
  if (!res.ok) return { errors: res.errors, warnings: res.warnings, draft };

  revalidatePath("/alerts");
  redirect(`/alerts/${res.alertId}?saved=${alertId ? "updated" : "created"}`);
}

export async function alertStatusAction(form: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const alertId = one(form, "alertId");
  const action = one(form, "action") as AlertAction;
  if (!isUuid(alertId) || !["pause", "resume", "delete"].includes(action)) redirect("/alerts");

  const res = await setAlertStatus(await getDb(), { userId: session.user.id, alertId, action, today: istToday() });
  revalidatePath("/alerts");
  if (action === "delete" && res.ok) redirect("/alerts?deleted=1");
  const back = one(form, "back") === "detail" ? `/alerts/${alertId}` : "/alerts";
  redirect(res.ok ? back : `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(res.error)}`);
}

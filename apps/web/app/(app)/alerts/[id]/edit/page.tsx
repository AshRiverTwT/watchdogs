import { notFound } from "next/navigation";
import { istToday } from "@watchdogs/core";
import { getUserAlert, viewToDraft } from "@watchdogs/db";
import { AlertForm } from "@/components/alert-form";
import { loadAlertFormData } from "@/lib/server/alert-form-data";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { isUuid } from "@/lib/server/http";

export const metadata = { title: "Edit alert · watchdogs" };

export default async function EditAlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/alerts/${id}/edit`);
  if (!isUuid(id)) notFound();
  const alert = await getUserAlert(await getDb(), user.id, id, istToday());
  if (!alert) notFound();
  const data = await loadAlertFormData();
  // Keep an archived/inactive movie selectable while editing an alert that already uses it.
  if (!data.movies.some((m) => m.id === alert.movie.id)) {
    data.movies.push({ id: alert.movie.id, title: alert.movie.title, status: "now_showing", language: null, variants: [] });
  }
  const rearm = alert.status === "fulfilled" || alert.status === "expired";
  return (
    <>
      <h1 className="font-display text-5xl font-bold uppercase">Edit alert</h1>
      {rearm && (
        <p className="mt-4 max-w-2xl text-paper/70">
          Saving turns this alert back on. Shows you were already emailed about will not be sent again.
        </p>
      )}
      <div className="mt-10">
        <AlertForm data={data} initial={viewToDraft(alert)} alertId={alert.id} />
      </div>
    </>
  );
}

import type { AlertStatus } from "@watchdogs/db";
import type { AlertView } from "@watchdogs/db";
import { summarizeDates } from "@watchdogs/core";
import { alertStatusAction } from "@/app/actions/alerts";

const STATUS: Record<AlertStatus, { label: string; cls: string }> = {
  active: { label: "Watching", cls: "bg-lime text-ink" },
  paused: { label: "Paused", cls: "border border-paper/50 text-paper" },
  fulfilled: { label: "Matched", cls: "bg-electric text-paper" },
  expired: { label: "Expired", cls: "border border-paper/25 text-paper/60" },
};

export function StatusPill({ status }: { status: AlertStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function describeWhere(a: Pick<AlertView, "theatres" | "areas">, cityName = "Hyderabad"): string {
  const parts = [...a.areas.map((x) => `${x.name} (all)`), ...a.theatres.map((t) => t.name)];
  if (parts.length === 0) return `Anywhere in ${cityName}`;
  return parts.length > 3 ? `${parts.slice(0, 3).join(", ")} +${parts.length - 3} more` : parts.join(", ");
}

export function AlertFacts({ a }: { a: AlertView }) {
  const rows: [string, string][] = [
    ["Dates", a.status === "expired" ? summarizeDates(a.dates) : summarizeDates(a.remainingDates)],
    ["Time", a.timeStart === "00:00" && a.timeEnd === "23:59" ? "Any time" : `${a.timeStart} – ${a.timeEnd}`],
    ["Language", a.events.length ? a.events.map((e) => e.language).join(", ") : "Any"],
    ["Format", a.formats.length ? a.formats.map((f) => f.name).join(", ") : "Any"],
    ["Where", describeWhere(a)],
    ["Stop", a.mode === "first_match" ? "After the first email" : "When the dates pass"],
  ];
  return (
    <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-1 text-base">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-paper/50">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const actionBtn =
  "h-10 border px-4 text-sm font-bold uppercase tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-lime";

export function AlertActions({ a, back }: { a: AlertView; back?: "detail" }) {
  const canPause = a.status === "active";
  const canResume = a.status === "paused" || (a.status === "fulfilled" && a.remainingDates.length > 0);
  return (
    <div className="flex flex-wrap gap-2">
      {canPause && (
        <form action={alertStatusAction}>
          <input type="hidden" name="alertId" value={a.id} />
          <input type="hidden" name="action" value="pause" />
          {back && <input type="hidden" name="back" value={back} />}
          <button className={`${actionBtn} border-paper/40 hover:border-paper`}>Pause</button>
        </form>
      )}
      {canResume && (
        <form action={alertStatusAction}>
          <input type="hidden" name="alertId" value={a.id} />
          <input type="hidden" name="action" value="resume" />
          {back && <input type="hidden" name="back" value={back} />}
          <button className={`${actionBtn} border-lime text-lime hover:bg-lime hover:text-ink`}>
            {a.status === "fulfilled" ? "Watch again" : "Resume"}
          </button>
        </form>
      )}
      <a href={`/alerts/${a.id}/edit`} className={`${actionBtn} inline-flex items-center border-paper/40 hover:border-paper`}>
        Edit
      </a>
      <DeleteButton id={a.id} />
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  // <details> gives a no-JS confirm step that works with the keyboard.
  return (
    <details className="group relative">
      <summary className={`${actionBtn} inline-flex cursor-pointer list-none items-center border-alert/70 hover:bg-alert`}>
        Delete
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-64 border border-alert bg-ink p-4 shadow-lg sm:left-0 sm:right-auto">
        <p className="text-sm">Delete this alert? You will get no more emails for it.</p>
        <form action={alertStatusAction} className="mt-3">
          <input type="hidden" name="alertId" value={id} />
          <input type="hidden" name="action" value="delete" />
          <button className={`${actionBtn} border-alert bg-alert`}>Yes, delete</button>
        </form>
      </div>
    </details>
  );
}

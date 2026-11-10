import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateShort, istToday } from "@watchdogs/core";
import { type AlertHistoryKind, getUserAlert } from "@watchdogs/db";
import { AlertActions, AlertFacts, StatusPill } from "@/components/alert-bits";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { isUuid } from "@/lib/server/http";

export const metadata = { title: "Alert · watchdogs" };

const HISTORY: Record<AlertHistoryKind, string> = {
  created: "Created",
  edited: "Edited",
  paused: "Paused",
  resumed: "Resumed",
  fulfilled: "Matched; stopped watching",
  expired: "Expired: all dates passed",
  deleted: "Deleted",
  matched: "Matching show found",
};

const when = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AlertDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const user = await requireUser(`/alerts/${id}`);
  if (!isUuid(id)) notFound();
  const today = istToday();
  const a = await getUserAlert(await getDb(), user.id, id, today);
  if (!a) notFound();
  const past = a.dates.filter((d) => d < today);

  return (
    <div className="max-w-3xl">
      <Link href="/alerts" className="text-sm uppercase tracking-wider text-paper/60 hover:text-lime">
        ← All alerts
      </Link>
      {saved && (
        <p role="status" className="mt-6 border-l-4 border-lime bg-lime/10 px-4 py-3">
          {saved === "created" ? "Alert created. We will email you when a matching show opens." : "Changes saved."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 border-l-4 border-alert bg-alert/10 px-4 py-3">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-5xl font-bold uppercase leading-none">{a.movie.title}</h1>
        <StatusPill status={a.status} />
      </div>

      <section className="mt-10 border-t border-paper/15 pt-8">
        <AlertFacts a={a} />
        {a.remainingDates.length > 0 && (
          <ul aria-label="Dates still to come" className="mt-6 flex flex-wrap gap-2">
            {a.remainingDates.map((d) => (
              <li key={d} className="rounded-full border border-paper/30 px-3 py-1 text-sm">
                {formatDateShort(d)}
              </li>
            ))}
            {past.length > 0 && <li className="px-1 py-1 text-sm text-paper/50">{past.length} past</li>}
          </ul>
        )}
        <div className="mt-8">
          <AlertActions a={a} back="detail" />
        </div>
      </section>

      <section aria-labelledby="matches" className="mt-12 border-t border-paper/15 pt-8">
        <h2 id="matches" className="font-display text-2xl font-bold uppercase">
          Emails sent
        </h2>
        <p className="mt-2 text-paper/60">
          {a.lastMatchedAt ? `Last match ${when(a.lastMatchedAt)}.` : "None yet. Matches appear here once the watcher finds one."}
        </p>
      </section>

      <section aria-labelledby="history" className="mt-12 border-t border-paper/15 pt-8">
        <h2 id="history" className="font-display text-2xl font-bold uppercase">
          History
        </h2>
        <ol className="mt-4 flex flex-col">
          {a.history.map((h, i) => (
            <li key={i} className="grid grid-cols-[9rem_1fr] gap-4 border-b border-paper/10 py-3 last:border-b-0">
              <time dateTime={h.createdAt.toISOString()} className="text-paper/50">
                {when(h.createdAt)}
              </time>
              <span>
                {HISTORY[h.kind]}
                {h.detail && <span className="text-paper/60"> · {h.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

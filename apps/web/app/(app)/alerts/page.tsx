import Link from "next/link";
import { istToday } from "@watchdogs/core";
import { listUserAlerts } from "@watchdogs/db";
import { AlertActions, AlertFacts, StatusPill } from "@/components/alert-bits";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

export const metadata = { title: "Alerts · watchdogs" };

const NOTICES: Record<string, string> = {
  verified: "Email confirmed. You are all set.",
  reset: "Password updated.",
  deleted: "Alert deleted.",
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser("/alerts");
  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((k) => params[k]);
  const alerts = await listUserAlerts(await getDb(), user.id, istToday());
  const open = alerts.filter((a) => a.status === "active" || a.status === "paused");
  const done = alerts.filter((a) => a.status === "fulfilled" || a.status === "expired");

  return (
    <div className="max-w-5xl">
      {notice && (
        <p role="status" className="mb-8 border-l-4 border-lime bg-lime/10 px-4 py-3">
          {NOTICES[notice]}
        </p>
      )}
      {params.error && (
        <p role="alert" className="mb-8 border-l-4 border-alert bg-alert/10 px-4 py-3">
          {params.error}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="font-display text-5xl font-bold uppercase">Your alerts</h1>
        {user.emailVerifiedAt && (
          <Link
            href="/alerts/new"
            className="cut bg-lime px-7 py-3 font-display font-bold italic uppercase text-ink hover:bg-paper"
          >
            New alert
          </Link>
        )}
      </div>

      {alerts.length === 0 && (
        <div className="cut mt-12 border border-paper/20 p-8">
          <p className="font-display text-2xl font-bold uppercase">No alerts yet</p>
          <p className="mt-2 text-paper/70">
            {user.emailVerifiedAt
              ? "Pick a movie, your dates and a time window. We email you when a matching show opens."
              : "Confirm your email first (see the banner above), then create your first alert."}
          </p>
        </div>
      )}

      {open.length > 0 && <AlertList title="Watching" alerts={open} />}
      {done.length > 0 && <AlertList title="Finished" alerts={done} muted />}
    </div>
  );
}

function AlertList({
  title,
  alerts,
  muted,
}: {
  title: string;
  alerts: Awaited<ReturnType<typeof listUserAlerts>>;
  muted?: boolean;
}) {
  return (
    <section aria-labelledby={`h-${title}`} className="mt-12">
      <h2 id={`h-${title}`} className="border-b border-paper/15 pb-3 text-sm font-bold uppercase tracking-[0.2em] text-paper/60">
        {title} · {alerts.length}
      </h2>
      <ul className="mt-6 grid gap-6 md:grid-cols-2">
        {alerts.map((a) => (
          <li key={a.id} className={`cut flex flex-col gap-5 border border-paper/20 p-6 ${muted ? "opacity-80" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-display text-2xl font-bold uppercase leading-tight">
                <Link href={`/alerts/${a.id}`} className="hover:text-lime">
                  {a.movie.title}
                </Link>
              </h3>
              <StatusPill status={a.status} />
            </div>
            <AlertFacts a={a} />
            <div className="mt-auto">
              <AlertActions a={a} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "Alerts · watchdogs" };

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  const user = await requireUser("/alerts");
  const { verified, reset } = await searchParams;
  return (
    <section className="max-w-3xl">
      {verified && <p role="status" className="mb-8 border-l-4 border-lime bg-lime/10 px-4 py-3">Email confirmed. You are all set.</p>}
      {reset && <p role="status" className="mb-8 border-l-4 border-lime bg-lime/10 px-4 py-3">Password updated.</p>}
      <h1 className="font-display text-5xl font-bold uppercase">Your alerts</h1>
      <p className="mt-4 text-paper/70">
        Signed in as {user.name ?? user.email}. Creating alerts arrives with the catalog in the next slice.
      </p>
    </section>
  );
}

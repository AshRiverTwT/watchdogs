import Link from "next/link";
import { AlertForm } from "@/components/alert-form";
import { loadAlertFormData } from "@/lib/server/alert-form-data";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "New alert · watchdogs" };

export default async function NewAlertPage() {
  const user = await requireUser("/alerts/new");
  if (!user.emailVerifiedAt) {
    return (
      <div className="max-w-xl">
        <h1 className="font-display text-5xl font-bold uppercase">New alert</h1>
        <p className="mt-6 text-paper/70">Confirm your email first; the banner above can resend the link.</p>
        <Link href="/alerts" className="mt-6 inline-block text-lime underline underline-offset-4">
          Back to alerts
        </Link>
      </div>
    );
  }
  const data = await loadAlertFormData();
  return (
    <>
      <h1 className="mb-10 font-display text-5xl font-bold uppercase">New alert</h1>
      <AlertForm data={data} />
    </>
  );
}

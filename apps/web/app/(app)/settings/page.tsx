import { requireUser } from "@/lib/server/auth";
import { ChangePasswordForm, SignOutEverywhere } from "./forms";

export const metadata = { title: "Settings · watchdogs" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-5xl font-bold uppercase">Settings</h1>

      <section aria-labelledby="account" className="mt-12 border-t border-paper/15 pt-8">
        <h2 id="account" className="font-display text-2xl font-bold uppercase">Account</h2>
        <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-paper/80">
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Status</dt>
          <dd>{user.emailVerifiedAt ? "Confirmed" : "Not confirmed yet"}</dd>
        </dl>
      </section>

      <section aria-labelledby="password" className="mt-12 border-t border-paper/15 pt-8">
        <h2 id="password" className="font-display text-2xl font-bold uppercase">Change password</h2>
        <ChangePasswordForm />
      </section>

      <section aria-labelledby="sessions" className="mt-12 border-t border-paper/15 pt-8">
        <h2 id="sessions" className="font-display text-2xl font-bold uppercase">Devices</h2>
        <p className="mt-2 text-paper/70">Sign out on every device, including this one.</p>
        <SignOutEverywhere />
      </section>
    </div>
  );
}

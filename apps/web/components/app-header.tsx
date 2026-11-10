import Link from "next/link";
import type { PublicUser } from "@watchdogs/auth";
import { logoutAction } from "@/app/actions/auth";
import { Wordmark } from "./wordmark";

export function AppHeader({ user }: { user: PublicUser }) {
  const link = "text-sm font-medium uppercase tracking-wider text-paper/80 hover:text-lime";
  return (
    <header className="border-b border-paper/15">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-lime focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-10">
        <Wordmark href="/alerts" />
        <nav aria-label="Main" className="flex flex-wrap items-center gap-6">
          <Link className={link} href="/alerts">
            Alerts
          </Link>
          <Link className={link} href="/settings">
            Settings
          </Link>
          {user.role === "admin" && (
            <Link className={link} href="/admin">
              Admin
            </Link>
          )}
          <form action={logoutAction}>
            <button type="submit" className={link}>
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

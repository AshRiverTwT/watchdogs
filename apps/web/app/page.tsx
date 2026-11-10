import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/server/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-paper/15 px-4 py-5 sm:px-10">
        <Wordmark />
        <nav aria-label="Account" className="flex items-center gap-6 text-sm font-medium uppercase tracking-wider">
          {user ? (
            <Link href="/alerts" className="hover:text-lime">Your alerts</Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-lime">Sign in</Link>
              <Link href="/signup" className="cut bg-lime px-5 py-2 font-display font-bold italic text-ink hover:bg-paper">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="main" className="px-4 py-24 sm:px-10">
        <h1 className="font-display text-6xl font-bold uppercase leading-none sm:text-8xl">
          Never miss<br />the <span className="text-lime">first show</span>
        </h1>
        <p className="mt-8 max-w-xl text-paper/70">
          Pick a movie, dates, a time window, a format and the theatres you like in Hyderabad. We email you once,
          the moment a matching show opens for booking.
        </p>
        <Link
          href={user ? "/alerts" : "/signup"}
          className="cut mt-10 inline-block bg-lime px-8 py-4 font-display font-bold italic uppercase text-ink hover:bg-paper"
        >
          {user ? "Go to your alerts" : "Create an alert"}
        </Link>
      </main>
    </div>
  );
}

import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-display text-xl font-bold uppercase tracking-widest" aria-label="watchdogs home">
      watch<span className="text-lime">dogs</span>
    </Link>
  );
}

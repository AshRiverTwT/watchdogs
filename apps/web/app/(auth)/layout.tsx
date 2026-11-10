import { Wordmark } from "@/components/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-paper/15 px-4 py-5 sm:px-10">
        <Wordmark />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

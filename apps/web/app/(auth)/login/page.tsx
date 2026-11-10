import Link from "next/link";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in · watchdogs" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Sign in</h1>
      <LoginForm next={next} />
      <p className="mt-8 text-paper/70">
        New here?{" "}
        <Link className="text-lime underline underline-offset-4" href="/signup">
          Create an account
        </Link>
      </p>
    </>
  );
}

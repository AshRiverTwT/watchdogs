import Link from "next/link";
import { SignupForm } from "./form";

export const metadata = { title: "Create account · watchdogs" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Create account</h1>
      <SignupForm />
      <p className="mt-8 text-paper/70">
        Already have one?{" "}
        <Link className="text-lime underline underline-offset-4" href="/login">
          Sign in
        </Link>
      </p>
    </>
  );
}

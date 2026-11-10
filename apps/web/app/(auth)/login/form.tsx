"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.fields?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <div className="flex items-center justify-between gap-4">
        <SubmitButton>Sign in</SubmitButton>
        <Link href="/forgot" className="text-sm text-paper/70 underline underline-offset-4 hover:text-lime">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

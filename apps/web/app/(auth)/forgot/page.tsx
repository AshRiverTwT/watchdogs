"use client";

import { useActionState } from "react";
import { forgotAction } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export default function ForgotPage() {
  const [state, action] = useActionState(forgotAction, undefined);
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Reset password</h1>
      <p className="mt-4 text-paper/70">We will email you a link to set a new password.</p>
      <form action={action} className="mt-8 flex flex-col gap-5">
        <FormMessage state={state} />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <div>
          <SubmitButton>Send link</SubmitButton>
        </div>
      </form>
    </>
  );
}

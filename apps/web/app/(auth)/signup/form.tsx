"use client";

import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export function SignupForm() {
  const [state, action] = useActionState(signupAction, undefined);
  if (state?.message) {
    return (
      <div className="mt-8">
        <FormMessage state={state} />
      </div>
    );
  }
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormMessage state={state} />
      <Field label="Name (optional)" name="name" autoComplete="name" required={false} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.fields?.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        hint="At least 10 characters. A short phrase works well."
      />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" minLength={10} />
      <div>
        <SubmitButton>Create account</SubmitButton>
      </div>
    </form>
  );
}

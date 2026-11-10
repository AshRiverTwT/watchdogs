"use client";

import { useActionState } from "react";
import { resetAction } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetAction, undefined);
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        hint="Saving it signs you out on every device."
      />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" minLength={10} />
      <div>
        <SubmitButton>Save password</SubmitButton>
      </div>
    </form>
  );
}

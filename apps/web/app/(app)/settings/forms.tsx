"use client";

import { useActionState } from "react";
import { changePasswordAction, logoutEverywhereAction } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <FormMessage state={state} />
      <Field label="Current password" name="current" type="password" autoComplete="current-password" />
      <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={10} />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" minLength={10} />
      <div>
        <SubmitButton>Change password</SubmitButton>
      </div>
    </form>
  );
}

export function SignOutEverywhere() {
  return (
    <form action={logoutEverywhereAction} className="mt-4">
      <SubmitButton variant="danger">Sign out everywhere</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { verifyAction } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/form";

export function VerifyForm({ token }: { token: string }) {
  const [state, action] = useActionState(verifyAction, undefined);
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <p className="text-paper/70">One click and you can start creating alerts.</p>
      <div>
        <SubmitButton>Confirm my email</SubmitButton>
      </div>
    </form>
  );
}

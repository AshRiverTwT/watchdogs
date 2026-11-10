"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/app/actions/auth";

export function VerifyBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerificationAction, undefined);
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-lime px-4 py-3 text-ink sm:px-10">
      <p className="font-medium">
        Confirm {email} to start receiving alerts.{" "}
        {state?.message && <span className="font-normal">{state.message}</span>}
      </p>
      <form action={action}>
        <button type="submit" disabled={pending} className="font-display font-bold italic uppercase underline underline-offset-4">
          {pending ? "Sending…" : "Resend link"}
        </button>
      </form>
    </div>
  );
}

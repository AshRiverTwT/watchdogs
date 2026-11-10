"use client";

import { useFormStatus } from "react-dom";

export function Field(props: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  const id = `f-${props.name}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium uppercase tracking-wider text-paper/80">
        {props.label}
      </label>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        required={props.required ?? true}
        minLength={props.minLength}
        aria-describedby={props.hint ? `${id}-hint` : undefined}
        className="h-12 border border-paper/30 bg-transparent px-4 text-paper focus:border-lime"
      />
      {props.hint && (
        <p id={`${id}-hint`} className="text-sm text-paper/60">
          {props.hint}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "lime",
}: {
  children: React.ReactNode;
  variant?: "lime" | "outline" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles = {
    lime: "bg-lime text-ink hover:bg-paper",
    outline: "border border-paper/40 text-paper hover:border-lime hover:text-lime",
    danger: "border border-alert text-paper hover:bg-alert",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`cut h-12 px-7 font-display font-bold italic uppercase tracking-wide transition-colors disabled:opacity-60 ${styles}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state?: { error?: string; message?: string } }) {
  if (!state?.error && !state?.message) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`border-l-4 px-4 py-3 text-base ${state.error ? "border-alert bg-alert/10" : "border-lime bg-lime/10"}`}
    >
      {state.error ?? state.message}
    </p>
  );
}

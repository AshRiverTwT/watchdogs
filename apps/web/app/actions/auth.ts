"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  getAuth,
  getSession,
  requestMeta,
  safeNext,
  setSessionCookie,
} from "@/lib/server/auth";

// Server actions are POST-only and Next.js rejects them when Origin does not match Host,
// which is the CSRF protection for every form below.

export type FormState = { error?: string; message?: string; fields?: Record<string, string> } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email");
  const password = str(form, "password");
  if (password !== str(form, "confirm")) return { error: "Passwords do not match.", fields: { email } };
  const res = await (await getAuth()).signup({ email, password, name: str(form, "name") });
  if (!res.ok) return { error: res.error, fields: { email } };
  return {
    message: `If ${email.trim()} can receive mail, a confirmation link is on its way. Open it to finish signing up.`,
  };
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email");
  const res = await (await getAuth()).login({ email, password: str(form, "password") }, await requestMeta());
  if (!res.ok) return { error: res.error, fields: { email } };
  await setSessionCookie(res.token, res.expiresAt);
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await (await getAuth()).logout((await cookies()).get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  redirect("/");
}

export async function verifyAction(_: FormState, form: FormData): Promise<FormState> {
  const auth = await getAuth();
  const res = await auth.verifyEmail(str(form, "token"));
  if (!res.ok) return { error: res.error };
  // Already signed in as this user in this browser? Keep that session; otherwise start one.
  const current = await getSession();
  if (!current || current.user.id !== res.userId) {
    const s = await auth.createSession(res.userId, await requestMeta());
    await setSessionCookie(s.token, s.expiresAt);
  }
  redirect("/alerts?verified=1");
}

export async function resendVerificationAction(): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  await (await getAuth()).resendVerification(session.user.id);
  return { message: "Sent. Check your inbox and spam folder." };
}

export async function forgotAction(_: FormState, form: FormData): Promise<FormState> {
  await (await getAuth()).requestPasswordReset(str(form, "email"));
  return { message: "If that address has an account, a reset link is on its way. It works for 1 hour." };
}

export async function resetAction(_: FormState, form: FormData): Promise<FormState> {
  const password = str(form, "password");
  if (password !== str(form, "confirm")) return { error: "Passwords do not match." };
  const auth = await getAuth();
  const res = await auth.resetPassword(str(form, "token"), password);
  if (!res.ok) return { error: res.error };
  const s = await auth.createSession(res.userId, await requestMeta());
  await setSessionCookie(s.token, s.expiresAt);
  redirect("/alerts?reset=1");
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const next = str(form, "password");
  if (next !== str(form, "confirm")) return { error: "New passwords do not match." };
  const res = await (await getAuth()).changePassword(
    session.user.id,
    str(form, "current"),
    next,
    session.sessionId,
  );
  return res.ok ? { message: "Password changed. Other devices were signed out." } : { error: res.error };
}

export async function logoutEverywhereAction() {
  const session = await getSession();
  if (!session) redirect("/login");
  await (await getAuth()).logoutAll(session.user.id);
  await clearSessionCookie();
  redirect("/login");
}

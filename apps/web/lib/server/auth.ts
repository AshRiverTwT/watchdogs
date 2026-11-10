import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AuthService, type PublicUser, SESSION_TTL_MS, createAuthService } from "@watchdogs/auth";
import { mailerFromEnv } from "@watchdogs/mail";
import { getDb } from "./db";

export const SESSION_COOKIE = "wd_session";

const g = globalThis as unknown as { __wdAuth?: Promise<AuthService> };

export function getAuth(): Promise<AuthService> {
  g.__wdAuth ??= getDb().then((db) =>
    createAuthService({ db, mailer: mailerFromEnv(), appUrl: process.env.APP_URL ?? "http://localhost:3000" }),
  );
  return g.__wdAuth;
}

export async function setSessionCookie(token: string, expiresAt?: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt ?? new Date(Date.now() + SESSION_TTL_MS),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
  };
}

/**
 * Current session, de-duplicated per request. Rolling expiry is extended in the DB here;
 * middleware.ts keeps the cookie's own expiry in step.
 */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (await getAuth()).validateSession(token);
});

export async function getCurrentUser(): Promise<PublicUser | null> {
  return (await getSession())?.user ?? null;
}

export async function requireUser(next?: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/alerts");
  return user;
}

/** Only allow same-site relative paths as post-login redirects. */
export function safeNext(next: unknown, fallback = "/alerts"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}

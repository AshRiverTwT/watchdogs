import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { type Db, sessions, users } from "@watchdogs/db";
import { createTestDb } from "@watchdogs/db/testing";
import { MemoryMailer } from "@watchdogs/mail";
import { type AuthService, SESSION_TTL_MS, createAuthService } from "./service";

const PASSWORD = "correct horse battery";

function linkToken(text: string, path: string): string {
  const m = new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`).exec(text);
  if (!m) throw new Error(`no ${path} link in: ${text}`);
  return m[1]!;
}

describe("auth service", () => {
  let db: Db;
  let close: () => Promise<void>;
  let mailer: MemoryMailer;
  let auth: AuthService;
  let clock: Date;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
    mailer = new MemoryMailer();
    clock = new Date("2026-11-10T10:00:00Z");
    auth = createAuthService({ db, mailer, appUrl: "http://app.test", now: () => clock });
  });
  afterEach(() => close());

  async function signupAndVerify(email = "Reader@Example.com") {
    await auth.signup({ email, password: PASSWORD });
    const token = linkToken(mailer.last()!.text, "/verify");
    const res = await auth.verifyEmail(token);
    if (!res.ok) throw new Error(res.error);
    return res.userId;
  }

  it("signs up, lower-cases the email and sends a verification link", async () => {
    const res = await auth.signup({ email: "  Reader@Example.com ", password: PASSWORD });
    expect(res.ok).toBe(true);
    const [u] = await db.select().from(users);
    expect(u!.email).toBe("reader@example.com");
    expect(u!.emailVerifiedAt).toBeNull();
    expect(u!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(mailer.last()!.to).toBe("reader@example.com");
  });

  it("rejects short passwords and bad emails", async () => {
    expect((await auth.signup({ email: "a@b.co", password: "short" })).ok).toBe(false);
    expect((await auth.signup({ email: "not-an-email", password: PASSWORD })).ok).toBe(false);
  });

  it("does not reveal existing accounts on signup", async () => {
    await signupAndVerify();
    const res = await auth.signup({ email: "reader@example.com", password: "another password" });
    expect(res.ok).toBe(true);
    expect(mailer.last()!.subject).toMatch(/already have/i);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("verification links work once and expire after 24h", async () => {
    await auth.signup({ email: "a@example.com", password: PASSWORD });
    const token = linkToken(mailer.last()!.text, "/verify");
    expect((await auth.verifyEmail(token)).ok).toBe(true);
    expect((await auth.verifyEmail(token)).ok).toBe(false);

    await auth.signup({ email: "b@example.com", password: PASSWORD });
    const late = linkToken(mailer.last()!.text, "/verify");
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    expect((await auth.verifyEmail(late)).ok).toBe(false);
  });

  it("logs in with the right password only, with the same error for unknown emails", async () => {
    await signupAndVerify();
    const wrong = await auth.login({ email: "reader@example.com", password: "wrong password" });
    const unknown = await auth.login({ email: "nobody@example.com", password: PASSWORD });
    expect(wrong).toEqual(unknown);
    const ok = await auth.login({ email: "READER@example.com", password: PASSWORD });
    expect(ok.ok).toBe(true);
  });

  it("rate-limits repeated failed logins", async () => {
    await signupAndVerify();
    for (let i = 0; i < 10; i++) await auth.login({ email: "reader@example.com", password: "nope nope nope" });
    const res = await auth.login({ email: "reader@example.com", password: PASSWORD });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/too many/i) });
  });

  it("stores only a hash of the session token and validates it", async () => {
    await signupAndVerify();
    const res = await auth.login({ email: "reader@example.com", password: PASSWORD });
    if (!res.ok) throw new Error(res.error);
    const [row] = await db.select().from(sessions);
    expect(row!.id).not.toBe(res.token);
    const v = await auth.validateSession(res.token);
    expect(v?.user.email).toBe("reader@example.com");
    expect(v?.refreshedExpiresAt).toBeUndefined();
    expect(await auth.validateSession("garbage")).toBeNull();
  });

  it("extends sessions past the halfway point and drops expired ones", async () => {
    await signupAndVerify();
    const res = await auth.login({ email: "reader@example.com", password: PASSWORD });
    if (!res.ok) throw new Error(res.error);

    clock = new Date(clock.getTime() + 20 * 24 * 60 * 60 * 1000);
    const v = await auth.validateSession(res.token);
    expect(v?.refreshedExpiresAt?.getTime()).toBe(clock.getTime() + SESSION_TTL_MS);

    clock = new Date(clock.getTime() + SESSION_TTL_MS + 1000);
    expect(await auth.validateSession(res.token)).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("logout deletes the session", async () => {
    await signupAndVerify();
    const res = await auth.login({ email: "reader@example.com", password: PASSWORD });
    if (!res.ok) throw new Error(res.error);
    await auth.logout(res.token);
    expect(await auth.validateSession(res.token)).toBeNull();
  });

  it("resets the password once, signs out everywhere, and only the newest link works", async () => {
    await signupAndVerify();
    const s = await auth.login({ email: "reader@example.com", password: PASSWORD });
    if (!s.ok) throw new Error(s.error);

    await auth.requestPasswordReset("reader@example.com");
    const first = linkToken(mailer.last()!.text, "/reset");
    await auth.requestPasswordReset("reader@example.com");
    const second = linkToken(mailer.last()!.text, "/reset");

    expect((await auth.resetPassword(first, "a brand new password")).ok).toBe(false);
    expect((await auth.resetPassword(second, "a brand new password")).ok).toBe(true);
    expect((await auth.resetPassword(second, "yet another password")).ok).toBe(false);

    expect(await auth.validateSession(s.token)).toBeNull();
    expect((await auth.login({ email: "reader@example.com", password: PASSWORD })).ok).toBe(false);
    expect((await auth.login({ email: "reader@example.com", password: "a brand new password" })).ok).toBe(true);
  });

  it("sends nothing when resetting an unknown email", async () => {
    await auth.requestPasswordReset("ghost@example.com");
    expect(mailer.sent).toHaveLength(0);
  });

  it("change password keeps the current session and ends the others", async () => {
    await signupAndVerify();
    const a = await auth.login({ email: "reader@example.com", password: PASSWORD });
    const b = await auth.login({ email: "reader@example.com", password: PASSWORD });
    if (!a.ok || !b.ok) throw new Error("login failed");
    const va = await auth.validateSession(a.token);

    const res = await auth.changePassword(va!.user.id, PASSWORD, "new password here", va!.sessionId);
    expect(res.ok).toBe(true);
    expect(await auth.validateSession(a.token)).not.toBeNull();
    expect(await auth.validateSession(b.token)).toBeNull();
  });

  it("disabled users cannot log in and lose existing sessions", async () => {
    const userId = await signupAndVerify();
    const s = await auth.login({ email: "reader@example.com", password: PASSWORD });
    if (!s.ok) throw new Error(s.error);
    await db.update(users).set({ disabledAt: clock }).where(eq(users.id, userId));
    expect(await auth.validateSession(s.token)).toBeNull();
    expect((await auth.login({ email: "reader@example.com", password: PASSWORD })).ok).toBe(false);
  });
});

import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";
import {
  type Db,
  type EmailTokenKind,
  type User,
  emailTokens,
  sessions,
  userPrefs,
  users,
} from "@watchdogs/db";
import type { Mailer } from "@watchdogs/mail";
import { getDummyHash, hashPassword, validatePassword, verifyPassword } from "./password";
import { RateLimiter } from "./rate-limit";
import { accountExistsEmail, resetEmail, verifyEmail } from "./emails";
import { isEmail, normalizeEmail, randomToken, sha256 } from "./tokens";

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY;
/** Sessions with less than this left are extended on use (rolling expiry). */
const SESSION_REFRESH_BELOW_MS = 15 * DAY;
const TOKEN_TTL: Record<EmailTokenKind, number> = {
  verify: DAY,
  reset: 60 * 60 * 1000,
  unsubscribe: 365 * DAY,
  pause: 30 * DAY,
};

export type PublicUser = Pick<User, "id" | "email" | "name" | "role" | "emailVerifiedAt">;

export interface AuthDeps {
  db: Db;
  mailer: Mailer;
  appUrl: string;
  now?: () => Date;
  loginLimiter?: RateLimiter;
  mailLimiter?: RateLimiter;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export function createAuthService(deps: AuthDeps) {
  const { db, mailer } = deps;
  const appUrl = deps.appUrl.replace(/\/$/, "");
  const now = deps.now ?? (() => new Date());
  // 10 failed logins per email per 15 min; 5 auth emails per address per hour.
  const loginLimiter = deps.loginLimiter ?? new RateLimiter(10, 15 * 60 * 1000, () => now().getTime());
  const mailLimiter = deps.mailLimiter ?? new RateLimiter(5, 60 * 60 * 1000, () => now().getTime());

  function toPublic(u: User): PublicUser {
    return { id: u.id, email: u.email, name: u.name, role: u.role, emailVerifiedAt: u.emailVerifiedAt };
  }

  async function issueEmailToken(userId: string, kind: EmailTokenKind, alertId?: string) {
    const token = randomToken();
    await db.insert(emailTokens).values({
      userId,
      kind,
      alertId: alertId ?? null,
      tokenHash: sha256(token),
      expiresAt: new Date(now().getTime() + TOKEN_TTL[kind]),
    });
    return token;
  }

  /** Marks a token used and returns its row, or null if unknown, used or expired. */
  async function consumeEmailToken(token: string, kind: EmailTokenKind) {
    const [row] = await db
      .update(emailTokens)
      .set({ usedAt: now() })
      .where(
        and(
          eq(emailTokens.tokenHash, sha256(token)),
          eq(emailTokens.kind, kind),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, now()),
        ),
      )
      .returning();
    return row ?? null;
  }

  async function findUserByEmail(email: string) {
    const [u] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
    return u ?? null;
  }

  async function sendVerification(user: Pick<User, "id" | "email">) {
    if (!mailLimiter.take(`mail:${user.email}`)) return;
    const token = await issueEmailToken(user.id, "verify");
    await mailer.send(verifyEmail(user.email, `${appUrl}/verify?token=${token}`));
  }

  async function createSession(userId: string, meta: SessionMeta = {}) {
    const token = randomToken();
    const expiresAt = new Date(now().getTime() + SESSION_TTL_MS);
    await db.insert(sessions).values({
      id: sha256(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
    });
    return { token, expiresAt };
  }

  return {
    createSession,

    /**
     * Always reports success so the form cannot be used to discover accounts.
     * New address: creates the user and sends a verification link.
     * Existing address: re-sends verification, or tells the owner someone tried to sign up.
     */
    async signup(input: { email: string; password: string; name?: string }): Promise<Result> {
      const email = normalizeEmail(input.email);
      if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
      const pwError = validatePassword(input.password);
      if (pwError) return { ok: false, error: pwError };

      const existing = await findUserByEmail(email);
      if (existing) {
        if (!existing.emailVerifiedAt) await sendVerification(existing);
        else if (mailLimiter.take(`mail:${email}`)) {
          await mailer.send(accountExistsEmail(email, `${appUrl}/login`, `${appUrl}/forgot`));
        }
        return { ok: true };
      }

      const passwordHash = await hashPassword(input.password);
      const [user] = await db
        .insert(users)
        .values({ email, passwordHash, name: input.name?.trim() || null })
        .onConflictDoNothing()
        .returning();
      if (!user) return { ok: true }; // lost a race with a concurrent signup
      await db.insert(userPrefs).values({ userId: user.id }).onConflictDoNothing();
      await sendVerification(user);
      return { ok: true };
    },

    async resendVerification(userId: string): Promise<void> {
      const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (u && !u.emailVerifiedAt) await sendVerification(u);
    },

    async verifyEmail(token: string): Promise<Result<{ userId: string }>> {
      const row = await consumeEmailToken(token, "verify");
      if (!row) return { ok: false, error: "This link is invalid or has expired." };
      await db.update(users).set({ emailVerifiedAt: now() }).where(eq(users.id, row.userId));
      return { ok: true, userId: row.userId };
    },

    async login(
      input: { email: string; password: string },
      meta: SessionMeta = {},
    ): Promise<Result<{ token: string; expiresAt: Date; user: PublicUser }>> {
      const email = normalizeEmail(input.email);
      const generic = { ok: false as const, error: "Email or password is incorrect." };
      if (!loginLimiter.take(`login:${email}`)) {
        return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." };
      }
      const user = await findUserByEmail(email);
      if (!user) {
        await verifyPassword(await getDummyHash(), input.password); // equalize timing
        return generic;
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) return generic;
      if (user.disabledAt) return { ok: false, error: "This account is disabled." };

      loginLimiter.reset(`login:${email}`);
      const { token, expiresAt } = await createSession(user.id, meta);
      return { ok: true, token, expiresAt, user: toPublic(user) };
    },

    /**
     * Resolves a cookie token. Returns `refreshedExpiresAt` when the session was
     * extended, so the caller can re-set the cookie.
     */
    async validateSession(
      token: string | undefined | null,
    ): Promise<{ user: PublicUser; sessionId: string; refreshedExpiresAt?: Date } | null> {
      if (!token) return null;
      const id = sha256(token);
      const [row] = await db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, id))
        .limit(1);
      if (!row) return null;
      const t = now();
      if (row.session.expiresAt <= t || row.user.disabledAt) {
        await db.delete(sessions).where(eq(sessions.id, id));
        return null;
      }
      let refreshedExpiresAt: Date | undefined;
      if (row.session.expiresAt.getTime() - t.getTime() < SESSION_REFRESH_BELOW_MS) {
        refreshedExpiresAt = new Date(t.getTime() + SESSION_TTL_MS);
        await db
          .update(sessions)
          .set({ expiresAt: refreshedExpiresAt, lastSeenAt: t })
          .where(eq(sessions.id, id));
      }
      return { user: toPublic(row.user), sessionId: id, refreshedExpiresAt };
    },

    async logout(token: string | undefined | null) {
      if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
    },

    async logoutAll(userId: string) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },

    /** Always succeeds from the caller's point of view. */
    async requestPasswordReset(rawEmail: string): Promise<void> {
      const email = normalizeEmail(rawEmail);
      if (!isEmail(email)) return;
      const user = await findUserByEmail(email);
      if (!user || user.disabledAt) return;
      if (!mailLimiter.take(`mail:${email}`)) return;
      // Only the newest reset link works.
      await db
        .update(emailTokens)
        .set({ usedAt: now() })
        .where(and(eq(emailTokens.userId, user.id), eq(emailTokens.kind, "reset"), isNull(emailTokens.usedAt)));
      const token = await issueEmailToken(user.id, "reset");
      await mailer.send(resetEmail(email, `${appUrl}/reset?token=${token}`));
    },

    async resetPassword(token: string, newPassword: string): Promise<Result<{ userId: string }>> {
      const pwError = validatePassword(newPassword);
      if (pwError) return { ok: false, error: pwError };
      const row = await consumeEmailToken(token, "reset");
      if (!row) return { ok: false, error: "This link is invalid or has expired." };
      const passwordHash = await hashPassword(newPassword);
      const [u] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      await db
        .update(users)
        // Clicking the emailed link also proves ownership of the address.
        .set({ passwordHash, emailVerifiedAt: u?.emailVerifiedAt ?? now() })
        .where(eq(users.id, row.userId));
      await db.delete(sessions).where(eq(sessions.userId, row.userId));
      return { ok: true, userId: row.userId };
    },

    async changePassword(userId: string, current: string, next: string, keepSessionId?: string): Promise<Result> {
      const pwError = validatePassword(next);
      if (pwError) return { ok: false, error: pwError };
      const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u || !(await verifyPassword(u.passwordHash, current))) {
        return { ok: false, error: "Current password is incorrect." };
      }
      await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
      // Sign out every other device.
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), keepSessionId ? ne(sessions.id, keepSessionId) : undefined));
      return { ok: true };
    },

    issueEmailToken,
    consumeEmailToken,

    /** Housekeeping, run by the worker daily. */
    async purgeExpired() {
      await db.delete(sessions).where(lt(sessions.expiresAt, now()));
      await db.delete(emailTokens).where(lt(emailTokens.expiresAt, now()));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

// Usage: pnpm --filter @watchdogs/auth make-admin someone@example.com [--revoke]
import { eq } from "drizzle-orm";
import { createDb, users } from "@watchdogs/db";
import { normalizeEmail } from "../tokens";

const email = normalizeEmail(process.argv[2] ?? "");
if (!email) throw new Error("Usage: make-admin <email> [--revoke]");
const role = process.argv.includes("--revoke") ? "user" : "admin";
const db = await createDb();
const rows = await db.update(users).set({ role }).where(eq(users.email, email)).returning({ id: users.id });
console.log(rows.length ? `${email} is now ${role}` : `no user with email ${email}`);
process.exit(rows.length ? 0 : 1);

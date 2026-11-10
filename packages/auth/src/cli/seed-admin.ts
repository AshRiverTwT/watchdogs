// Creates (or promotes) the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
import { eq } from "drizzle-orm";
import { createDb, userPrefs, users } from "@watchdogs/db";
import { hashPassword, validatePassword } from "../password";
import { normalizeEmail } from "../tokens";

const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? "");
const password = process.env.SEED_ADMIN_PASSWORD ?? "";
if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
const pwError = validatePassword(password);
if (pwError) throw new Error(`SEED_ADMIN_PASSWORD: ${pwError}`);

const db = await createDb();
const [existing] = await db.select().from(users).where(eq(users.email, email));
if (existing) {
  await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
  console.log(`${email} already exists; role set to admin (password unchanged)`);
} else {
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), role: "admin", emailVerifiedAt: new Date() })
    .returning();
  await db.insert(userPrefs).values({ userId: u!.id });
  console.log(`created admin ${email}`);
}
process.exit(0);

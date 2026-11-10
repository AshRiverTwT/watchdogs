# watchdogs

Create an alert for a movie, dates, time window, format and theatre in Hyderabad,
and get one email when a matching show opens for booking on BookMyShow.

> Status: slice 1 (auth) done. See `docs/ARCHITECTURE.md` for the plan.

## Local development

Requires Node 22.9+ and pnpm 9 (`npm i -g pnpm@9`). Docker is optional.

```bash
cp .env.example .env      # then fill SESSION_SECRET, SEED_ADMIN_PASSWORD
pnpm install
```

**With Docker** (Postgres + Mailpit):

```bash
docker compose up -d postgres mailpit
pnpm db:migrate
pnpm seed:admin
pnpm dev                  # web on :3000; Mailpit UI on :8025
```

**Without Docker**: set these in `.env`, then run the same `db:migrate`, `seed:admin`, `dev` steps.
PGlite is in-process Postgres, so only one process can open the database at a time
(fine for the web app alone; the worker needs real Postgres).

```
DATABASE_URL=pglite://./.pgdata
MAIL_TRANSPORT=console    # emails are printed in the dev-server terminal
```

## Commands

| Command | What it does |
|---|---|
| `pnpm test` | Vitest: unit tests plus integration tests on an in-memory Postgres (PGlite) |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm db:generate` | Generate a SQL migration from `packages/db/src/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm seed:admin` | Create or promote the admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` |
| `pnpm make-admin <email> [--revoke]` | Grant or remove the admin role |

## Auth

- Email + password (argon2id). Passwords need at least 10 characters.
- Sessions live in Postgres; the browser holds a random token in the `wd_session` cookie
  (httpOnly, SameSite=Lax, Secure in production). Only its SHA-256 is stored. Sessions last
  30 days, and using one in its second half extends it.
- Email confirmation and password reset use single-use hashed tokens (24 h and 1 h).
  Confirmation needs a button click, so mail scanners that prefetch links cannot use up the token.
- Signup and reset never reveal whether an address has an account. Failed logins are limited
  to 10 per address per 15 minutes; auth emails to 5 per address per hour.
- All mutations are Next.js server actions (POST-only, Origin checked against Host by Next).
- Resetting a password signs out every device; changing it signs out every other device.
- Roles: `user`, `admin`. Admin only through `seed:admin` or `make-admin`.

## Slice 0: BMS access check

See [scripts/access-check/README.md](scripts/access-check/README.md). Run it on the EC2
instance before the live adapter is built; its verdict decides whether the EC2 browser
or the laptop collector is the default source.

## Terms of use and risk

To be filled in during slice 6 with the relevant clause of BookMyShow's current terms.
Automated access is likely prohibited; this project is for personal, low-volume use and
may get an IP or account blocked.

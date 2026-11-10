# watchdogs

Create an alert for a movie, dates, time window, format and theatre in Hyderabad,
and get one email when a matching show opens for booking on BookMyShow.

> Status: slice 0 (scaffold + access check). See `docs/ARCHITECTURE.md` for the plan.

## Local development

Requires Node 20+, pnpm 9 (`corepack enable`) and Docker.

```bash
cp .env.example .env
docker compose up -d postgres mailpit
pnpm install
pnpm test
pnpm dev          # web on :3000, worker in the same terminal
```

Mailpit UI: http://localhost:8025

## Slice 0: BMS access check

See [scripts/access-check/README.md](scripts/access-check/README.md). Run it on the EC2
instance before the live adapter is built; its verdict decides whether the EC2 browser
or the laptop collector is the default source.

## Terms of use and risk

To be filled in during slice 6 with the relevant clause of BookMyShow's current terms.
Automated access is likely prohibited; this project is for personal, low-volume use and
may get an IP or account blocked.

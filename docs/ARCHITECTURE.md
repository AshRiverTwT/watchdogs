# Architecture

Filled in during slice 8: component diagram, data flow, failure modes.

| Package | Role |
|---|---|
| `apps/web` | Next.js App Router UI and API |
| `apps/worker` | scheduler, watcher, mail jobs (pg-boss), collector CLI |
| `packages/db` | Drizzle schema, migrations, seed |
| `packages/core` | pure matching, dedupe, grouping, validation |
| `packages/scraper` | `ShowSource` interface and adapters |
| `packages/mail` | `Mailer` interface, SMTP adapter, templates |

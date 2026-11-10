# One image for web and worker. Playwright's image ships Chromium and its system deps.
FROM mcr.microsoft.com/playwright:v1.49.1-noble
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/mail/package.json packages/mail/
COPY packages/scraper/package.json packages/scraper/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @watchdogs/web build
ENV NODE_ENV=production

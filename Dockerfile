# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @szavak/shared build
RUN cd apps/server && pnpm exec prisma generate
RUN pnpm --filter @szavak/server build
RUN pnpm --filter @szavak/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# /data is the SQLite location (file:/data/szavak.db). When a Fly volume is
# mounted here it persists; when none is mounted, /data is just a writable
# directory in the container so the DB still works (just ephemerally).
RUN mkdir -p /data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/data ./data

EXPOSE 3001
WORKDIR /app/apps/server
# On boot: apply pending Prisma migrations, idempotently seed the family
# profiles, then start the server.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/db/seed.js && node dist/index.js"]

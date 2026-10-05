# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=bio-org-pnpm,target=/app/.sites-runtime/pnpm-store \
    pnpm install --prod=false --frozen-lockfile --fetch-timeout=600000

FROM dependencies AS build
COPY . .
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8787
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/scripts/run-node.mjs ./scripts/run-node.mjs
COPY --from=build /app/scripts/database-init.mjs ./scripts/database-init.mjs
COPY --from=build /app/scripts/migrate-postgres.mjs ./scripts/migrate-postgres.mjs
COPY --from=build /app/.migration ./.migration
COPY --from=build /app/db/postgres.sql ./db/postgres.sql

EXPOSE 8787

CMD ["node", "scripts/run-node.mjs", "start"]

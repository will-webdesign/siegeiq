# ── base: install workspace deps once ────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/shared/package.json packages/shared/
COPY packages/game-data/package.json packages/game-data/
COPY packages/coaching/package.json packages/coaching/
COPY packages/server/package.json packages/server/
RUN npm install --no-audit --no-fund
COPY . .
RUN npx prisma generate

# ── api service ──────────────────────────────────────────────────────
FROM base AS api
EXPOSE 4000 4100
CMD ["npm", "run", "start", "-w", "@siegeiq/api"]

# ── web (marketing site) ─────────────────────────────────────────────
FROM base AS webbuild
RUN npm run build -w @siegeiq/web
FROM node:22-alpine AS web
WORKDIR /app
COPY --from=webbuild /repo/apps/web/.next/standalone ./
COPY --from=webbuild /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=webbuild /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

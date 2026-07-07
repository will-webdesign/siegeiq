# SiegeIQ

**The Rainbow Six Siege improvement coach.** Not another stats tracker —
statistics exist here only to power coaching, decision support and
measurable improvement. Every insight answers *what should I do next* and
shows the evidence behind it.

The primary product is the **Overwolf desktop application**. The website is
a landing page (download, docs, changelog, public profiles).

## Monorepo layout

```
apps/
  desktop/    Overwolf app (PRIMARY): desktop window, in-game overlay,
              background service, GEP engine + dev-mode match simulator
  api/        SiegeIQ API service (Fastify): providers, caching, DB, live WS.
              All credentials live here — users never configure anything.
  web/        Next.js marketing site + public player profiles
packages/
  shared/     Domain types, constants, ranks, provenance, pure utils
  game-data/  Versioned game data (operators/maps/weapons/seasons) — data, not code
  coaching/   Pure evidence-gated coaching: insight rules, live coach
  server/     Server-only: Ubisoft/R6Data providers, services, cache, DB
prisma/       Database schema (players, snapshots, goals, round records)
tests/        Cross-package unit tests (vitest)
```

## Commands

```bash
npm install               # once, at the root (npm workspaces)
npm run db:generate       # prisma client

npm run dev:api           # API on :4000  (DEMO_MODE=true for zero-credential dev)
npm run dev:desktop       # Overwolf app in browser dev mode (simulated match)
npm run dev:web           # marketing site on :3000 (proxies /api → :4000)

npm run typecheck         # packages + api + tests
npm test                  # vitest
npm run build             # all workspaces
npm run build:desktop     # typecheck + production bundle for Overwolf
```

## Core principles

1. **Zero configuration.** Users provide at most a Ubisoft username +
   platform. Keys, auth, caching, failover — all server-side.
2. **Never present data we don't have.** Every stat/insight carries source,
   confidence, evidence, data type (observed/calculated/inferred) and
   freshness. Gaps render as honest empty states, never placeholders.
3. **Game data is data.** Operators/maps/seasons are versioned JSON
   (`@siegeiq/game-data`, currently Y11S2.1) updated independently of code.
4. **Coaching explains why.** Evidence Cards are the atomic unit of every
   recommendation, in the app and the overlay.

## Hardware validation

Overwolf/GEP integration is implemented against the official docs and fully
exercised in dev mode via the scripted match simulator, but live game events
must be validated on a Windows machine with Overwolf + R6 — see
[TESTING.md](./TESTING.md) for the exact checklist.

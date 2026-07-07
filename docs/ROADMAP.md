# SiegeIQ — Implementation Roadmap

Phases are cumulative; each ends in a deployable state. ✅ = built in the initial session.

## Phase 0 — Foundations ✅
Repo, strict TypeScript, Next.js 15 App Router, Tailwind 4 design system (dark glass), ESLint/Prettier, Vitest, CI, Docker + docker-compose (app, worker, Postgres, Redis), env contract (`.env.example`), demo mode.

## Phase 1 — Data platform ✅
Provider contracts + registry (failover, circuit breaker, health), UbisoftProvider (session manager, profiles, full_profiles, datadev playerstats, playtime, service status), R6DataProvider adapter, DemoProvider, Redis read-through cache + SWR refresh, token-bucket provider budgets, retry/backoff, Prisma schema + snapshot/match-inference engine, REST API surface with zod envelopes.

## Phase 2 — Core product ✅
Home (search, service status, meta highlights), Player Profile (rank header, boards, stat tiles, rank graph, operator/weapon/map tabs, match timeline, insights), Operators/Weapons/Maps databases with detail pages, insights rules engine + unit tests, admin panel (health/cache/queues/flags), PWA + SEO baseline.

## Phase 3 — Live match & companion ✅ (skeleton)
WS ingest + subscribe in worker, pairing-token flow, live page with roster scouting and evidence-gated live coach, Overwolf companion skeleton in `companion/` (manifest + GEP forwarding). Hardening (reconnect storms, roster edge cases, multi-monitor overlay UI) continues post-launch with real in-game testing, which cannot happen in this environment.

## Phase 4 — Launch hardening
Real-credential soak test (rate budgets vs. real traffic), season-rollover archive drill, error budget + alerting (Sentry), per-player OG images, backfill `TrackedPlayer` refresh tiers, legal pages, player opt-out flow, Cloudflare in front (WAF + cache rules), load test profile page (target p95 < 300 ms cached).

## Phase 5 — Differentiators
Player comparison, global leaderboards from own DB, custom leaderboards, meta dashboards (pick/win/ban from Ubisoft top-operators data or R6Data), tier lists, streak/tilt analytics ("you play 21% better after winning pistol"— requires companion round telemetry), best-squad detection from shared lobbies, achievements, daily challenges.

## Phase 6 — Coach v2
Round-level models on companion telemetry (entry success, trade rates, site-specific tendencies), optional LLM rephrasing of engine output (facts locked to evidence objects), ban predictor and operator recommendation from lobby context, replay (.rec) ingestion via R6Data parser or in-house parser.

## Phase 7 — Scale & monetize
Premium tier (deeper history, ad-free, OBS overlay), mobile PWA polish, CDN-cached public profiles, read replicas, per-region workers, SLA dashboards.

## Standing engineering rules
Season constants updated each season (one PR: season id, name, ops, balance table). Any provider schema drift must fail loudly in health checks, never silently render wrong numbers. No feature may present estimated data without a confidence label. The demo provider must always keep the full UI navigable with zero credentials.

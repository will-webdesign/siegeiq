# SiegeIQ — Technical Audit (pre-V3)

Date: 2026-07-07. Companion doc to [RESEARCH.md](./RESEARCH.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md). This audit validates the foundation before any V3 feature work begins, per the development rules given for this pass.

## 0. Foundation validation (executed, not assumed)

Run in a clean environment (the sandbox's mounted project folder itself has flaky bulk-file-operation support — unrelated to the code — so validation ran against a fresh copy):

| Step | Result |
|---|---|
| `npm install` | **Passed** — 462 packages, clean, no unresolved peer conflicts |
| `npx tsc --noEmit` | **Failed initially, now fixed** — see below |
| `npx prisma generate` | Passed |
| `npx next build` | **Passed** — 106 routes, all app/API routes compiled, static pages generated |
| `npx vitest run` | **Passed** — 4 suites, 25/25 tests |
| `npx next lint` | Passed, 0 warnings (tool itself is deprecated in Next 16 — migrate later) |
| `tsx` import smoke test on worker | Passed |

**Bug found and fixed:** `src/worker/queues.ts` failed typecheck because `bullmq` vendors its own nested `ioredis` (5.10.1) while the project depended on a newer top-level `ioredis` (5.11.1). The two `Redis` classes are structurally incompatible to TypeScript even though they're runtime-compatible, so passing one ioredis instance into BullMQ's `connection` option failed to typecheck. Fixed by adding an `overrides` field to `package.json` (`"ioredis": "$ioredis"`), which forces npm to dedupe to a single copy tree-wide. Verified: after the fix, only one `ioredis` package exists in `node_modules` and `tsc --noEmit` exits 0.

**Action needed on your machine:** the project's real `node_modules` folder got left in a partially-deleted state by a failed cleanup attempt during this audit (a sandbox/mount limitation, not something wrong with your files). Run `rm -rf node_modules package-lock.json && npm install` locally before your next `npm run dev`/`build` — this will pick up the `overrides` fix and produce a clean lockfile. This is the one manual step left from this audit.

Redis/DB connection errors appeared during `next build` (`ECONNREFUSED 127.0.0.1:6379`) — expected and handled gracefully; the cache layer logs and falls through rather than crashing the build. Not a defect.

## 1. Architecture map (as built, verified against source)

**Frontend:** Next.js 15 App Router, RSC + streaming. Routes: `/`, `/operators(+[slug])`, `/weapons`, `/maps(+[slug])`, `/profile/[platform]/[username]`, `/live`, `/admin`. Component layers: `components/ui.tsx` (primitives), per-feature folders (`profile/`, `operators/`, `weapons/`, `live/`, `home/`), `charts.tsx` (Recharts), `motion.tsx` (Framer Motion wrappers).

**Backend (API):** Route handlers under `src/app/api/*` — `players/search`, `players/[profileId]/[section]`, `status`, `health`, `live/[profileId]`, `live/pair`, `admin/overview`. All funnel through `src/lib/services/player-service.ts`, which wraps every call in `Sourced<T>` (`{ data, source, fetchedAt, stale }`) — this is the existing provenance envelope and the natural extension point for the V3 "universal data provenance" requirement.

**Database:** PostgreSQL via Prisma. Verified models: `Player`, `ProfileSnapshot`, `InferredMatch`, `SeasonArchive`, `TrackedPlayer`, `LiveSession`, `LiveMatchEvent`. **Discrepancy from ARCHITECTURE.md:** the doc describes `OperatorSeasonStat`/`MapSeasonStat`/`WeaponSeasonStat` tables for persisted per-season aggregates — these do not exist in `schema.prisma`. In the actual code, operator/map/weapon stats are fetched live from the provider chain on every cache miss (Redis-cached, not DB-persisted). This means historical operator/map/weapon breakdowns are only as deep as Ubisoft's current-season answer — there's no SiegeIQ-side accumulation of that data over time yet, unlike rank (which is snapshotted). Worth a decision: either update the docs to match reality, or add those tables (real work, not documentation).

**Workers:** Two responsibilities in `src/worker/`: `queues.ts` (BullMQ jobs — tracked-player refresh every 5 min, season archive sweep daily — with an in-process `setInterval` fallback when `REDIS_URL` is unset, so it degrades rather than silently doing nothing) and `live-server.ts` (raw `ws` WebSocket server, HMAC-signed pairing tokens, in-memory per-profile match state with a 3-minute staleness cutoff). **Scaling gap confirmed by reading the code:** live match state lives in a single process's memory (`Map<string, LiveMatchState>`); the doc's mention of "Redis pub/sub fan-out for multi-instance" is aspirational — not implemented. Fine for one worker instance, will silently drop cross-instance viewers if ever scaled horizontally.

**Overwolf integration:** `companion/` — manifest targets game id `10826`, requests `GameInfo`/`Extensions`/`Hotkeys` permissions, forwards normalized events to `/ingest`. This is a skeleton: no icons (Overwolf packaging requires them), never loaded into a real Overwolf runtime, GEP event/field names not verified against current Overwolf docs for this patch. Zero real-world runtime evidence it works.

**Data providers:** `src/lib/providers/` — `types.ts` (contracts), `registry.ts` (priority chain + per-provider circuit breaker + `activeProviders()`), `ubisoft/` (auth + client + provider), `r6data.ts`, `demo.ts`. Read directly: the failover logic is correct and deliberate — `NotFoundError` (player genuinely doesn't exist) does not trigger failover or trip the circuit, only real provider failures do. This is good engineering, but it has never executed against a live Ubisoft session — the burner-account flow, ticket refresh, and 429 handling are unverified against the real service.

**Insights engine:** `src/lib/insights/engine.ts` — confirmed evidence-gated: every rule checks a minimum sample size (`MIN_SAMPLES`) before emitting an `Insight`, and every `Insight` carries `{ severity, confidence, evidence }`. **Gap against the V3 spec:** `Insight` does not yet carry `source`, `timestamp`, or an explicit `observed | calculated | inferred` type tag — the spec's universal provenance requirement is broader than what's implemented today. This is the concrete, scoped piece of work Step 3 of your rules is asking for; it's not a rewrite, it's three new fields plus updating every call site that constructs an `Insight`.

## 2. Feature status

✅ Production ready: provider registry (failover/circuit breaker logic), Redis read-through cache with SWR pattern, Zod-validated API envelopes, insights engine's evidence-gating mechanism (the mechanism, not yet the full provenance fields), unit test suite (25 tests, all real logic — retry, match inference, data integrity, insights), demo provider (fully deterministic, zero-credential UI).

🟡 Partially implemented: Ubisoft/R6Data provider adapters (code complete, correct against documented endpoints, never executed against live credentials — session/ticket refresh and rate-limit behavior are unverified); live match pipeline (WebSocket hub works and is tested in isolation, but single-instance only, and has zero connection to a real GEP feed); rank history and match inference (real logic, tested, but depends on snapshots accumulating over time — a brand-new deployment has no history until it's been running); admin panel (health/cache/queue visibility exists per docs, not independently verified this pass).

🔴 Prototype only: Overwolf companion (manifest + event-forwarding skeleton, no icons, never run inside real Overwolf, GEP field names unverified against current docs); operator/map/weapon per-season persistence (doc describes it, code doesn't have it — currently live-fetched only).

⚫ Not started: universal data-provenance fields on `Insight` (source/timestamp/observed-calculated-inferred) and on raw stat displays; Learning Goals; Session Reports; Evidence Cards as a UI primitive; Team Intelligence (operator combos/comps/synergy); any authentication system (this is a deliberate product decision, not a gap — SiegeIQ's spec explicitly has no end-user accounts, only a server-side service credential, so there is nothing to build here unless that decision changes).

## 3. Risk report

**Security:** service credentials (`UBI_EMAIL`/`UBI_PASSWORD`, `R6DATA_API_KEY`) are server-env only, never exposed to the client — verified in `env.ts`. Admin routes gated by bearer token — verified present, not verified against a brute-force/rate-limit angle. Pairing tokens use HMAC with constant-time comparison (`timingSafeEqual`) — correct implementation, no state needed on the worker side, which is good but means a leaked `PAIRING_SECRET` compromises all pairings; rotation plan isn't documented. No CSRF surface reviewed yet for admin POST routes (worth a pass before real deployment).

**Missing infrastructure:** no live Postgres/Redis were connected during this audit (by design — demo mode/graceful degradation covered it) so DB migrations (`prisma migrate`) have never actually run against a real database; only `prisma generate` (client codegen) was exercised. Migration drill is still outstanding. No CI evidence beyond the `.github/workflows/ci.yml` file's existence — not verified it currently passes on a real runner.

**Broken assumptions:** ARCHITECTURE.md's per-season operator/map/weapon persistence doesn't exist in code (see §1). The "Redis pub/sub for multi-instance live" is aspirational, not real. Season/operator static data verified only through Y9S4 (already known from RESEARCH.md) — Y10/Y11 need a refresh pass before any statistic claims about "current season" are trustworthy, which directly matters for the V3 trust principle.

**Technical debt:** `next lint` is deprecated (Next 16 will remove it) — low urgency, but note it now rather than discover it during an upgrade. The ioredis dedupe fix should be re-verified after any future BullMQ/ioredis version bump, since a future divergence could reintroduce the same typecheck break.

**External dependencies (unchanged from RESEARCH.md, restated for risk-tracking):** Ubisoft's undocumented endpoints (no SLA, no contract), R6Data as a third-party fallback (its own uptime/quota risk), Overwolf's GEP (historically suspended once already in 2025 by Ubisoft/BattlEye coordination).

## 4. What this means for Step 6 (V3 implementation order)

Foundation is now genuinely verified, not assumed — the one remaining action is the local `node_modules` reinstall noted in §0. Reliable data (existing provider/cache/snapshot layer) is real and tested but has never touched live credentials — first real-credential run should happen before layering the evidence system on top, since a provenance system is only as trustworthy as the data flowing beneath it. The evidence/provenance schema extension (§1 Insights gap) is the correct next concrete step, followed by the one-complete-loop build ("reduce early deaths") your rules specified — that loop should be built directly on the extended `Insight` type, not around it.

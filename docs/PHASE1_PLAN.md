# SiegeIQ V3 Phase 1–3 — Implementation Plan

Written before coding, per the V3 rules. Extends the existing architecture (docs/ARCHITECTURE.md) — nothing here replaces the provider registry, cache layer, or insights engine's evidence-gating mechanism, all confirmed working in docs/AUDIT.md.

## 1. Database changes (prisma/schema.prisma)

Two new models, additive only — no changes to existing models beyond adding two relation fields on `Player`.

`LearningGoal`: one row per (profileId, goalType). Fields: `id`, `profileId`, `goalType` (string, only `"reduce_early_deaths"` is a supported value right now — kept as a string not an enum so adding goal types later is a data change, not a migration), `active`, `createdAt`, `baselineSeconds` (nullable Float — null until enough rounds exist to compute one), `baselineSampleSize`, `baselineComputedAt`. Unique on `(profileId, goalType)` — one goal of a given type per player.

`RoundRecord`: the atomic evidence unit for "early deaths." One row per round: `profileId`, `playedAt`, `map`, `side` (attacker/defender), `operatorSlug` (nullable), `survivedSeconds` (time alive before dying, or full round length if the player survived), `died` (bool), `source` (`"companion"` for real Overwolf telemetry or `"demo"` — never silently mixed). This does not exist anywhere today; it's genuinely new ground truth, not a repurposing of `LiveMatchEvent` (which stores raw untyped JSON payloads, not analysis-ready rows).

Both models cascade-delete with `Player`, matching the existing pattern.

Since no live Postgres was available to run migrations against during this pass, the schema was validated with `prisma validate`/`generate` only (both pass). **`prisma migrate dev --name phase1_goals_provenance` must be run against a real database before this ships** — that's the concrete migration step, not yet executed, because there is no database attached in this environment.

## 2. Type changes

New file `src/lib/provenance.ts`: `DataType = "observed" | "calculated" | "inferred"`, `Freshness = "fresh" | "cached" | "stale"`, a `Provenance` interface (`source`, `confidence`, `evidence`, `timestamp`, `dataType`, `freshness`), and a `freshnessOf(ageMs)` helper. This is the one shared shape everything else attaches to.

`Insight` (in `src/lib/insights/engine.ts`) extends `Provenance` instead of its own ad hoc `{severity, confidence, evidence}`. `profileInsights()` gains a `ctx: { source: string; fetchedAt: number }` parameter (the provenance of the underlying stats it's reasoning over) so every rule can stamp `source`/`timestamp`/`freshness` without guessing. All current rules are `dataType: "calculated"` — they read recorded aggregates, they don't predict anything. `"inferred"` is reserved for goal recommendations (Phase 2), which genuinely extrapolate beyond raw numbers.

New `src/lib/goals/types.ts`: `GoalType` (currently just `"reduce_early_deaths"`), `RoundRecordInput`, `GoalProgress` (extends `Provenance`, adds `previousAverageSeconds`, `currentAverageSeconds`, `improvementSeconds`, `sampleSize`), `SessionReportFinding` (extends `Provenance`, adds `kind: "strength" | "weakness" | "recommendation"`, `title`).

## 3. API changes

Extend the existing `players/[profileId]/[section]/route.ts` catch-all rather than inventing a new route family:
- `GET .../goals` → active goal + progress (or `null` if none created)
- `POST .../goals` → body `{ goalType }`, creates the goal, computes baseline from existing `RoundRecord`s if any exist
- `GET .../session-report` → latest session findings, or an explicit "not enough rounds this session" response (never a fabricated one)

`live-server.ts`'s companion event schema gains one new event kind, `round_end`, carrying `{ map, side, operatorSlug, survivedSeconds, died }` for the tracked profile. On ingestion, the worker persists a `RoundRecord` (best-effort, via `tryDb`, same non-fatal pattern as everything else). This is the one real place round-level telemetry can come from — nothing here invents survival data if the companion isn't connected.

## 4. Component structure

`src/components/evidence-card.tsx` — the reusable primitive: recommendation/title, reason, an evidence list, and a footer row of source/confidence/data-type/updated-timestamp badges, styled to match the existing glass-card language (no new visual system, per the "don't redesign yet" instruction). `InsightsPanel` is refactored to render `Insight[]` through this component instead of its own hand-rolled card markup — one less place formatting can drift.

`src/components/goals/goal-card.tsx` — shows a "Start this goal" empty state when no `LearningGoal` exists, or the progress view (previous vs. current average, improvement, confidence, sample size) once one does.

`src/components/profile/session-report.tsx` — renders `SessionReportFinding[]` through `EvidenceCard`, grouped by strength/weakness/recommendation, or an empty state below the round threshold.

Profile page (`src/app/profile/[platform]/[username]/page.tsx`) gains two new sections between "Coach insights" and the detail tables: Learning Goal and Session Report. Demo mode continues to work end-to-end: a deterministic demo `RoundRecord` generator (same `mulberry32`/`hash32` seeding pattern as the rest of `demo.ts`) lets the goal and session-report UI be fully exercised with zero credentials and zero companion, clearly source-tagged `"demo"`.

## 5. Migration plan

Order of work: (1) schema + `prisma generate`/`validate` (no live DB touched), (2) `provenance.ts` + `Insight` upgrade + call-site updates, (3) `EvidenceCard` + `InsightsPanel` refactor, (4) goal service (baseline/progress calculation) + demo round-record generator, (5) API routes, (6) goal + session-report UI wired into the profile page, (7) full rebuild/typecheck/test pass in a clean environment to confirm nothing regressed. Real `prisma migrate dev` against a live database, and a real companion emitting `round_end` events, are both explicitly **not** executed in this pass — they need your actual Postgres instance and a real Overwolf session respectively, neither of which exist in this sandbox. Everything else is built and verified end-to-end in demo mode.

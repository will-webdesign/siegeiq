# SiegeIQ — Data Source Research

Date: 2026-07-07. Every claim below was verified against a primary source during research; sources are linked inline. This document is the ground truth for what data SiegeIQ can and cannot obtain.

## Executive summary

There is **no official public Ubisoft API** for Rainbow Six Siege statistics. Every tracker site — including R6 Tracker — operates by calling Ubisoft's **undocumented internal web-service endpoints** (`public-ubiservices.ubi.com` and `prod.datadev.ubisoft.com`) authenticated with an ordinary Ubisoft account held server-side. Live match data is **impossible from a browser**: R6 Tracker's live features come from a desktop app built on **Overwolf's Game Events Provider (GEP)**, a mechanism explicitly tolerated (and in 2025, actively coordinated) by Ubisoft and BattlEye. Match history is **not provided by Ubisoft at all**; trackers reconstruct it from rank-point deltas between profile snapshots and from telemetry uploaded by their desktop-app users. Since Ranked 2.0 (Dec 2022), Ubisoft's API returns **only the current season**, so historical season data exists only if a tracker recorded it while the season was live.

Consequences for SiegeIQ: the website works with only a username + platform (server resolves everything); a service credential lives in server env vars (end users never authenticate); live match intelligence requires an optional desktop companion; rank history accumulates from the day we first see a player.

## 1. How R6 Tracker works

**Player stats (website).** R6 Tracker's servers call Ubisoft's internal APIs on behalf of visitors. Direct evidence: their December 2022 notice states "Ubisoft has switched over to a new API (Ubisoft APIs provide us with your profile stats)… The new API does not allow us to check previous season stats, only the current season. Once Brutal Swarm ends, we won't be able to refresh your Brutal Swarm stats anymore." ([post-S27 season support article](https://tracker.gg/r6siege/articles/post-s27-season-support-r6siege)). This also confirms they must snapshot data before each season rollover, and that Ranked 2.0 hidden MMR is unavailable ("we won't be able to display your hidden MMR").

**Live match (desktop app).** From their November 2025 outage postmortem: "Our app uses Overwolf to get live match data. Overwolf was causing some players' game to crash… Ubisoft instructed BattlEye to temporarily block Overwolf… Overwolf, Ubisoft and BattlEye were all working together to make some changes to how Overwolf interacts with the game." Live features are PC-only and were restored after a coordinated rollout ([R6 Live Match Features Return](https://tracker.gg/r6siege/articles/r6-live-match-features-return)). This is definitive: their live scouting is Overwolf GEP, not a web API, not HTML scraping, and not their own memory reader.

**Match history.** Ubisoft exposes no per-match endpoint. The `full_profiles` ranked endpoint includes aggregate season counters (kills, deaths, wins, losses, abandons, rank points, update timestamp). By polling it and diffing successive snapshots, a tracker infers "a ranked match happened, RP changed by +32, W/L moved." Rich per-match data (operators used, per-round events) appears only for matches where at least one participant ran the desktop app, which uploads Overwolf event telemetry. This is why R6 Tracker web-only match rows show RP deltas while app-tracked rows show full scoreboards.

**Their own public API?** No. Tracker Network's developer program does not include Rainbow Six Siege (supported titles are Apex, CS:GO/CS2, Division 2, Splitgate); a February 2025 developer thread confirms Siege is absent ([tracker.gg/developers](https://tracker.gg/developers), [feedback thread](https://feedback.tracker.gg/t/rainbow-six-siege-api-for-devs/54318)).

## 2. Data source inventory

### 2.1 Ubisoft internal endpoints (primary source — unofficial, undocumented)

Status: **unofficial**. These are the game's/first-party site's own web services. They require authentication with any Ubisoft account (community practice is a dedicated "burner" account with 2FA disabled, kept in server env vars — see [SwiftCODA/R6-API](https://github.com/SwiftCODA/R6-API): "you must be logged into a Ubisoft account with 2FA disabled. You can even create a 'burner' Ubisoft account"). Community wrappers documenting these endpoints: [r6api.js](https://github.com/danielwerg/r6api.js) (Node, now unmaintained — author: "R6API.js won't be maintained in foreseeable future… working with Ubisoft APIs is pain"), its `next` branch, [R6Data npm](https://github.com/danielwerg/r6data) (constants/assets), and SwiftCODA/R6-API (active, seasons through Y9+).

| Purpose | Endpoint | Notes |
|---|---|---|
| Session (login) | `POST https://public-ubiservices.ubi.com/v3/profiles/sessions` | Headers: `Authorization: Basic base64(email:password)`, `Ubi-AppId`, JSON body `{"rememberMe":true}`. Returns `ticket`, `sessionId`, `expiration` (~3 h). Subsequent calls use `Authorization: ubi_v1 t=<ticket>` + `Ubi-AppId` + `Ubi-SessionId`. |
| Username → profile | `GET /v3/profiles?namesOnPlatform={name}&platformType={uplay\|psn\|xbl}` | Returns `profileId` (UUID), `userId`, `nameOnPlatform`. Avatars at `ubisoft-avatars.akamaized.net/{profileId}/default_256_256.png`. Steam/Epic players resolve via their linked Ubisoft (uplay) name; `findById` also accepts platform IDs (e.g. Xbox XUID). |
| Ranked 2.0 (current season) | `GET /v2/spaces/{spaceId}/title/r6s/skill/full_profiles?profile_ids={ids}&platform_families={pc\|console}` | The modern "seasonal v2" source (r6api.js `getUserSeasonalv2`). Boards: `ranked`, `casual`, `event`, `warmup` (+ `standard`/`dual_front` in newer seasons). Returns rank id, rank points, max rank/RP, kills/deaths, W/L, abandons per board. **Current season only.** |
| Detailed stats | `GET https://prod.datadev.ubisoft.com/v1/profiles/{profileId}/playerstats?spaceId={spaceId}&view=seasonal&aggregation={summary\|operators\|maps\|weapons\|trend}&gameMode=all,ranked,casual,unranked&platform={PC\|PS4\|XONE}&teamRole=all&seasons={list}` | Powers Ubisoft's own [stats site](https://www.ubisoft.com/en-us/game/rainbow-six/siege/stats). Per-season, per-side operator/map/weapon breakdowns: rounds, K/D, W/L, headshots, aces, first bloods/deaths, clutches, time played. The legacy `/statscard`-era endpoint broke at Heavy Mettle and was never fixed ([r6api.js #78 note](https://github.com/danielwerg/r6api.js)); `datadev` is the one that works. |
| Playtime | `GET /v1/profiles/stats?profileIds={ids}&spaceId={spaceId}&statsName=PPvPTimePlayed,PPvETimePlayed,PTotalTimePlayed` | Seconds played, per queue. |
| Level/XP | `GET /v1/spaces/{spaceId}/title/r6s/rewards/public_profile?profile_id={id}` | Clearance level, XP, alpha-pack chance (r6api.js `getProgression`). |
| Presence | `GET /v1/users/{userId}/status` | Online/offline + running application (r6api.js `getUserStatus`). |
| Service status | `GET https://game-status-api.ubisoft.com/v1/instances?appIds={ids}` | Public, **no auth**. Per-platform online/maintenance flags. |
| News/patch notes | Ubisoft CMS feed (`nimbus.ubisoft.com`/ubi.com news API, locale-aware) | Public, no auth (r6api.js `getNews`). |

Space IDs (from r6api.js/r6data constants): PC `5172a557-50b5-4665-b7db-e3f2e8c5041d`, PS4 `05bfb3f7-6c21-4c42-be1f-97a33fb5cf66`, Xbox One `98a601e5-ca91-4440-b1c5-753f601a2c90`; cross-play "platform families" (pc/console) supersede per-platform boards for ranked 2.0.

Known behaviors and hazards, all observed by the community: tickets expire (~3 h) and must be refreshed; logging in too often triggers `429 Too Many Requests` (SwiftCODA warns against >3 restarts/hour); endpoints occasionally break at season boundaries (Heavy Mettle broke the legacy stats endpoint permanently; Brutal Swarm/Solar Raid changed the ranked model); only the current season is queryable since Ranked 2.0; hidden MMR is gone. Season IDs count upward from launch (Solar Raid = 28; community sources show Y10S4 = 40, Y11S1 = 41, so mid-2026 ≈ season 42).

**ToS position:** using these endpoints is not sanctioned by an official developer program; it is the same tolerated gray area every Siege tracker occupies (Ubisoft demonstrably knows — it coordinated with Overwolf/BattlEye to keep R6 Tracker functioning rather than shutting it down). Mitigations SiegeIQ adopts: dedicated service account, aggressive caching to minimize call volume, exponential backoff on 429/5xx, honest attribution, player opt-out/removal on request, and no circumvention of any Ubisoft privacy flag.

**Operational safety — single burner account (READ BEFORE TUNING LIMITS).** SiegeIQ authenticates to Ubisoft with **exactly one** shared burner account, and will for the foreseeable future. There is **no automatic account rotation** and no second Ubisoft account to fail over to — the provider chain can only fall back to `r6data` or `demo` (see `registry.ts`). Consequences and the enforced cadence:

- **Single point of failure.** If Ubisoft rate-limits or bans this account for unusual traffic, live data goes down for *every* user simultaneously. Treat the account as a scarce, non-replaceable resource.
- **Global outbound ceiling.** All Ubisoft calls across all users share one process-wide token bucket (`bucketFor("ubisoft", 5, 2)` in `providers/ubisoft/client.ts`) — burst 5, **≈120 requests/minute hard ceiling app-wide**, not per-user. Do not raise this to "make things faster"; if 429s appear, lower it.
- **Login cadence.** Re-login sparingly: the session ticket (~3h) is cached and logins are single-flighted (`auth.ts`). Never exceed community guidance of **≤3 logins/hour** for the account.
- **Refresh cadence for tracked players.** Do not blast profile refreshes: aim for **no more than ~1 refresh per tracked player per 10 minutes**, and let the shared 120 req/min ceiling absorb bursts. Bulk/scheduled refresh jobs must go through the same rate limiter, not around it.
- **Fail closed, honestly.** When Ubisoft is rate-limited/circuit-open and no `r6data`/`demo` fallback is configured, the API returns **HTTP 503 + `Retry-After` + `{ unavailable: true }`** ("data temporarily unavailable") rather than a raw error or stale data presented as fresh (`envelope.ts` `fail()`). The circuit breaker trips early and backs off long (`CircuitBreaker(3, 120_000)` in `registry.ts`) specifically because there is no second account to absorb continued failures.
- **Out of scope (intentionally):** multi-account rotation infrastructure. Do not build it until a real second account exists; the safeguards above are designed for the one-account reality.

### 2.2 R6Data community API (secondary/fallback provider)

[api.r6data.com](https://r6data.com/api-docs) is a community-run REST API (with an npm SDK, [r6-data.js](https://github.com/mazeor9/r6-data.js)) that proxies the same Ubisoft player data plus a large static database. Auth is a single `api-key` header issued from their dashboard — held server-side by the site operator; end users never see it. Endpoints verified from their docs: `accountInfo`, `fullStats` (merges operator stats + `platform_families_full_profiles` + per-season segments), `operatorStats` (per-season/per-playlist, incl. clutches, first bloods, multi-kills), `seasonalStats` (RP history points), `seasonsStats`, `leaderboards`, `isBanned` (ban alerts), plus static `operators/weapons/maps/seasons/ranks/charms/attachments`, `servicestatus`, and a **.rec replay parser** (`POST /api/replays/api/upload`, quota'd). Quota-based free tier with paid plans; usage endpoint `GET /api/me/usage`.

Value: removes the burner-account requirement, adds leaderboards/ban data/replay parsing we'd otherwise build. Risks: third-party availability, quotas/cost, another hop of staleness. Verdict: implemented as a **fallback provider adapter**, not the primary.

### 2.3 Overwolf Game Events Provider (live match — desktop only)

Overwolf publishes an official GEP for Siege ([docs](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/rainbow-six-siege/)) exposing real-time `game_info`, `match_info` (including the **roster**: names, teams, operators), `kill`/`death`, round and phase events, and `me` (local player). This is exactly what powers R6 Tracker's live scoreboard (player names → their servers look up each name's stats → overlay shows ranks/K/D per player). It requires the Overwolf runtime on Windows alongside the game. BattlEye whitelists Overwolf; independent memory reading outside Overwolf risks bans and is **out of scope permanently**.

### 2.4 Static game data (operators, weapons, maps)

Sources: [danielwerg/r6data](https://github.com/danielwerg/r6data) npm package (operator/season/rank constants, MIT-licensed data used by r6api.js), [marcopixel/r6operators](https://r6operators.marcopixel.eu) (operator icon set, attribution required), R6Data API static endpoints (§2.2), Ubisoft patch notes for balance changes. SiegeIQ ships a curated JSON seed (versioned in-repo, provenance-tagged) refreshed each season via script; per-operator pick/win/ban rates are Ubisoft "Top Operators" board data or R6Data — never invented.

## 3. What is impossible (and must never be faked)

**Browser-only live match detection.** No Ubisoft endpoint exposes "current match of player X" (the presence endpoint says only that the game is running). Browsers cannot read game memory, logs, or local sockets. Therefore SiegeIQ's live features activate only when the optional desktop companion (Overwolf-based) streams events to our backend over WebSockets. The website states this honestly instead of pretending.

**Historical seasons before first sighting.** Ubisoft returns current-season data only; a player first looked up in Y11S2 will have history from Y11S2 onward. R6 Tracker has the same constraint and asks users to refresh profiles before season end.

**Hidden MMR, per-match server data, enemy-team data without a companion in the lobby.** Not available to anyone since Ranked 2.0.

## 4. Decision matrix

| Need | Chosen source | Fallback |
|---|---|---|
| Username → profileId (all platforms) | Ubisoft `v3/profiles` | R6Data `accountInfo` |
| Rank, RP, current season boards | Ubisoft `skill/full_profiles` | R6Data `fullStats` |
| Operator/map/weapon/seasonal detail | Ubisoft `datadev playerstats` | R6Data `operatorStats`/`fullStats` |
| Rank history & match list | **Own snapshots + RP-delta inference** (Postgres) | — (nobody provides this) |
| Full match telemetry | Companion (Overwolf GEP) via WS | — |
| Level/playtime/presence | Ubisoft v1 endpoints | R6Data |
| Leaderboards | Own DB over tracked players | R6Data `leaderboards` |
| Ban status | R6Data `isBanned` | — |
| Static operator/weapon/map data | In-repo seed JSON (r6data npm + curated) | R6Data static endpoints |
| Service status | Ubisoft `game-status-api` (public) | R6Data `servicestatus` |
| News/patch notes | Ubisoft CMS (public) | — |

## 5. Source list

- https://tracker.gg/r6siege/articles/r6-live-match-features-return — Overwolf dependency, BattlEye block, PC-only live features
- https://tracker.gg/r6siege/articles/post-s27-season-support-r6siege — Ubisoft API switch, current-season-only, no hidden MMR
- https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/rainbow-six-siege/ — GEP events for Siege
- https://github.com/danielwerg/r6api.js — endpoint documentation, maintenance notice, seasonal v2, broken legacy stats
- https://github.com/danielwerg/r6data — static data package
- https://github.com/SwiftCODA/R6-API — active wrapper, burner-account practice, rate-limit warnings
- https://r6data.com/api-docs — community REST API surface, quotas, replay parser
- https://tracker.gg/developers + https://feedback.tracker.gg/t/rainbow-six-siege-api-for-devs/54318 — no public TRN API for R6
- https://www.ubisoft.com/en-us/game/rainbow-six/siege/stats — Ubisoft's own stats site (datadev consumer)
- https://r6operators.marcopixel.eu — operator icons (attribution)

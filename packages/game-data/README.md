# Static game data — provenance & maintenance

Data vintage: **Y11S2 | Operation System Override (current season as of 2026-07-07)**. Version is
tracked as `GAME_DATA_VERSION` in `src/index.ts` (currently `Y11S2.2`). Entries carrying a
`seedNote` still need verification against the current season. The full Y10/Y11 attacker and
defender roster is included through Solid Snake (Y11S1 | Operation Silent Hunt).

## Changelog

- **Y11S2.2** (2026-07-07): Filled Solid Snake's loadout (previously left blank pending
  verification) from the official Ubisoft operator page — primaries F2 + PMR90A2, secondary
  TACIT .45, gadgets Frag/Stun/Impact-EMP/Smoke/Breach Charge, Soliton Radar MK III ability.
  Added `pmr90a2` and `tacit-45` weapon entries; their exact damage/RPM/mag/ADS/reload are
  **unverified** and left `null` with a `seedNote` rather than guessed. Verified the current
  roster against Ubisoft's operator list — no operators missing; Y11S2 is the current season
  (no Y11S3 yet, it opens Sept 2026).
- **Y11S2.1**: Prior pass through Y11S2 with Rauora/Denari loadouts and Solid Snake stub.

Sources: community-maintained constants ([danielwerg/r6data](https://github.com/danielwerg/r6data),
MIT), Ubisoft patch notes, and long-standing community measurements for weapon values (damage/RPM
are stable, ADS/reload are approximations). Operator icons are intentionally *not* bundled —
[marcopixel/r6operators](https://r6operators.marcopixel.eu) can be added with attribution; the UI
uses styled monograms until then, which keeps licensing clean.

Per-season checklist (one PR):
1. Bump `CURRENT_SEASON_ID` and append the season in `src/lib/constants.ts` (set `verified: true`).
2. Add new operators/weapons here; clear resolved `seedNote`s.
3. Update `src/lib/insights/counters.ts` for balance changes that alter counter logic.
4. Run `npm test` — data-shape tests validate slugs/references.

These files are the single source of truth for the operator/weapon/map database pages, the demo
provider, and the coach's counter tables. Player *statistics* never come from here.

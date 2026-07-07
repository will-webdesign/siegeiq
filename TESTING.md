# TESTING.md — What must be verified on a real Windows machine

Everything in this repo typechecks, builds and passes unit tests in CI-like
conditions. But an Overwolf app ultimately runs inside the Overwolf client on
Windows with Rainbow Six Siege — several integration points can only be
validated there. This file is the definitive checklist.

## Prerequisites

1. Windows 10/11 PC with Rainbow Six Siege installed (Ubisoft Connect or Steam).
2. Overwolf client installed (https://www.overwolf.com).
3. Node 22+, then from the repo root: `npm install && npm run build:desktop`.
4. Load the app as an unpacked extension: Overwolf → Settings → About →
   Development options → Load unpacked extension → select `apps/desktop/dist`
   (with `manifest.json` copied from `apps/desktop/public` into `dist` — the
   build places it there automatically via the public dir).
5. Run the backend locally: `npm run dev:api` (set `DEMO_MODE=true` for a
   zero-credential run) — or point `VITE_API_URL` at a deployed API before
   building.

## A. App lifecycle (Overwolf)

- [ ] Installing and launching the app opens the **desktop window** (not the overlay).
- [ ] Launching R6 with the app installed auto-starts the app minimized
      (`launch_events` / GameLaunch) and opens the **in-game overlay**.
- [ ] Closing R6 fires `game_closed`; overlay closes; background survives.
- [ ] App relaunch remembers window positions (`keep_window_location`).

## B. Overlay behavior (in game)

- [ ] Overlay renders transparent, on top of the game, at 60fps.
- [ ] `Ctrl+Shift+S` toggles the overlay (manifest hotkey `siegeiq_toggle_overlay`).
- [ ] Overlay is draggable by its header; position persists.
- [ ] Overlay never blocks game UI at 1080p, 1440p, ultrawide.
- [ ] Alt-tab / fullscreen exclusive vs. borderless behavior acceptable
      (`focus_game_takeover: ReleaseOnHidden`).

## C. Game events (GEP) — the critical section

Open **Diagnostics** in the desktop window while playing. Verify:

- [ ] "GEP connection" turns green after game launch (setRequiredFeatures
      succeeds; retries are logged if the provider is slow to attach).
- [ ] `game_info.phase` transitions appear in the raw event log
      (lobby → operator_select → loading → round_results).
- [ ] `match_info`: pseudo_match_id, game_mode, map_id arrive; map name
      resolves correctly in the Live Match view (check the slugification of
      `map_id` against real payloads — implemented from docs, MUST be
      validated against live data).
- [ ] `roster_XX` parsing: 10 players, correct ally/enemy split (local player
      is always "blue" per GEP docs), operator attribution correct.
- [ ] `kill` / `headshot` / `death` / `knockedout` events increment the
      session round stats.
- [ ] `defuser_planted` / `defuser_disabled` events appear in the feed.
- [ ] Round/score tracking matches the actual match result.
- [ ] Ranked, Standard, Quick Match all produce events. Custom games and
      Match Replay do NOT (documented Overwolf limitation — verify the app
      degrades gracefully, shows "waiting", never errors).
- [ ] Event flood during heavy rounds doesn't drop frames (event log is
      capped at 200 entries).

Known GEP caveats from the official docs (verify current behavior):
- Team colors don't match in-game UI colors since Dec 2021; local player is
  always blue in GEP payloads.
- GEP health for R6 can change per game patch — check
  https://dev.overwolf.com/ow-native/live-game-data-gep/game-events-status-health/

## D. Account linking & data

- [ ] Settings → enter Ubisoft username → search returns candidates via the
      SiegeIQ API (never a client-side Ubisoft call; no keys on the client).
- [ ] Dashboard loads ranked board, K/D, win rate with source attribution.
- [ ] With the API stopped, the app shows "unavailable" states — it must
      NEVER show cached-as-fresh or invented numbers.

## E. Coaching

- [ ] Live Match view + overlay show evidence-backed calls only when the
      full roster is known (no hard breach / no anti-gadget warnings etc.).
- [ ] Every rendered insight shows confidence, data type, source, freshness.
- [ ] With zero personal stats available, only team-comp insights appear.

## F. Performance targets

- [ ] Desktop window cold start < 2s on a mid-range PC.
- [ ] Background window RSS < 100MB after a 2-hour session (no leak growth).
- [ ] Overlay CPU < 2% while idle in-round.
- [ ] No jank when the event log is full (200 entries) and updating.

## G. Notifications & hotkeys

- [ ] Hotkey rebinding via Overwolf settings is respected (read through
      `overwolf.settings.hotkeys.get`).

## What does NOT need hardware

- Unit tests (`npm test`), typecheck, web build, API routes, coaching logic,
  goal engine, session reports, demo mode — all run anywhere. Dev mode
  (`npm run dev:desktop`, open desktop.html in a browser) simulates a full
  scripted match through the exact same event pipeline as real GEP.

/**
 * Real Overwolf GEP adapter for Rainbow Six Siege (game 10826).
 *
 * Built against the typed R6 schema in @overwolf/types (overwolf.gep.R6):
 *   Events : roundStart, roundEnd, roundOutcome, matchOutcome,
 *            kill, headshot, knockedout, death, killer
 *   Info   : phase, pseudo_match_id, game_mode, map_id, number (round),
 *            score{blue,orange}, players{roster_0..3}, me{operator,…}
 *
 * onInfoUpdates2 may deliver `info` flat or nested under its feature category
 * depending on client build, so we resolve every field with a depth-agnostic
 * `pluck()` walk rather than assuming a shape. Anything we can't parse is left
 * out (surfaced only via diagnostics) — never guessed. Exact runtime payloads
 * must still be validated on Windows with Overwolf + R6 running (TESTING.md).
 */
import { slugify } from "@siegeiq/shared";
import type { LiveMatchState, LiveRosterPlayer } from "@siegeiq/shared";
import {
  REQUIRED_FEATURES,
  type GepSource,
  type GepStatus,
  type GepVersionInfo,
  type SiegeEvent,
  type SiegeEventListener,
  type GamePhase,
  type RoundOutcomeType,
} from "./types";
import { R6_GAME_ID } from "../ow/env";
import { createLogger } from "@/core/log";

const log = createLogger("gep");
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 20;

const PHASES: readonly GamePhase[] = [
  "lobby",
  "teammates",
  "announce",
  "operator_select",
  "loading",
  "round_results",
];

/** Depth-first search for the first property named `key`, at any nesting. */
function pluck(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  if (key in rec) return rec[key];
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      const found = pluck(v, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** GEP frequently double-encodes objects as JSON strings — decode if needed. */
function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : value != null ? String(value) : null;
}

export class OverwolfGepSource implements GepSource {
  private listeners = new Set<SiegeEventListener>();
  private st: GepStatus = {
    source: "overwolf",
    connected: false,
    featuresRequested: REQUIRED_FEATURES,
    featuresGranted: [],
    lastEventAt: null,
    gameRunning: false,
    error: null,
    version: null,
    degradedFeatures: [],
  };
  private roster = new Map<string, LiveRosterPlayer>();
  private round = 0;
  private score = { ally: 0, enemy: 0 };
  private map: string | null = null;
  private mode: string | null = null;
  private matchId: string | null = null;
  private lastKiller: string | null = null;
  private roundOutcomeType: RoundOutcomeType | null = null;
  private roundEndHandled = false;
  private retries = 0;

  async start(): Promise<void> {
    overwolf.games.onGameInfoUpdated.addListener((info) => {
      const running = Boolean(info?.gameInfo?.isRunning && this.isR6(info.gameInfo.id));
      if (running && !this.st.gameRunning) {
        this.st.gameRunning = true;
        this.emit({ type: "game_launched" });
        this.setFeatures();
      }
      if (!running && this.st.gameRunning && info?.runningChanged) {
        this.reset();
        this.emit({ type: "game_closed" });
      }
    });

    overwolf.games.getRunningGameInfo((info) => {
      if (info && info.isRunning && this.isR6(info.id)) {
        this.st.gameRunning = true;
        this.emit({ type: "game_launched" });
        this.setFeatures();
      }
    });

    overwolf.games.events.onInfoUpdates2.addListener((u) => this.onInfo(u));
    overwolf.games.events.onNewEvents.addListener((e) => this.onEvents(e));
    overwolf.games.events.onError.addListener((err) => {
      this.st.error = String(err?.reason ?? "GEP error");
      log.warn("gep error", err?.reason);
    });
  }

  stop(): void {
    this.listeners.clear();
  }

  status(): GepStatus {
    return { ...this.st };
  }

  on(listener: SiegeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private reset(): void {
    this.st.gameRunning = false;
    this.st.connected = false;
    this.roster.clear();
    this.round = 0;
    this.score = { ally: 0, enemy: 0 };
    this.map = null;
    this.mode = null;
    this.matchId = null;
    this.lastKiller = null;
    this.roundOutcomeType = null;
  }

  /** Set by the GEP health service from Overwolf's public status feed. */
  setDegradedFeatures(features: string[]): void {
    this.st.degradedFeatures = features;
  }

  private isR6(id: number): boolean {
    return Math.floor(id / 10) === Math.floor(R6_GAME_ID / 10) || id === R6_GAME_ID;
  }

  private setFeatures(): void {
    overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (res) => {
      if (res.success) {
        this.st.connected = true;
        this.st.error = null;
        this.st.featuresGranted = res.supportedFeatures ?? [];
        this.retries = 0;
        log.info("GEP features granted", res.supportedFeatures);
      } else if (this.retries < MAX_RETRIES) {
        // GEP is often not ready at the instant of game launch — back off.
        this.retries += 1;
        setTimeout(() => this.setFeatures(), RETRY_DELAY_MS);
      } else {
        this.st.error = res.error ?? "setRequiredFeatures failed";
      }
    });
  }

  private emit(event: SiegeEvent): void {
    this.st.lastEventAt = Date.now();
    for (const l of this.listeners) l(event);
  }

  private emitRoster(side: "attacker" | "defender" | null = null): void {
    const state: LiveMatchState = {
      profileId: "",
      map: this.map,
      mode: this.mode,
      round: this.round,
      side,
      score: this.score,
      roster: [...this.roster.values()],
      updatedAt: Date.now(),
    };
    this.emit({ type: "roster_update", state });
  }

  /* ── info updates ──────────────────────────────────────────────────── */
  private onInfo(u: overwolf.games.events.InfoUpdates2Event): void {
    const info = u?.info as unknown;
    if (!info) return;

    // gep_internal.version_info — surface GEP staleness in Diagnostics.
    const versionInfo = asObject(pluck(info, "version_info"));
    if (versionInfo) {
      const ver: GepVersionInfo = {
        localVersion: strOrNull(versionInfo["local_version"] ?? versionInfo["localVersion"]),
        publicVersion: strOrNull(versionInfo["public_version"] ?? versionInfo["publicVersion"]),
        upToDate:
          typeof versionInfo["is_updated"] === "boolean"
            ? (versionInfo["is_updated"] as boolean)
            : typeof versionInfo["up_to_date"] === "boolean"
              ? (versionInfo["up_to_date"] as boolean)
              : null,
      };
      this.st.version = ver;
    }

    const phase = pluck(info, "phase");
    if (typeof phase === "string") {
      this.emit({
        type: "phase",
        phase: (PHASES as readonly string[]).includes(phase) ? (phase as GamePhase) : "unknown",
      });
    }

    const matchId = pluck(info, "pseudo_match_id");
    if (typeof matchId === "string" && matchId && matchId !== this.matchId) {
      this.matchId = matchId;
      this.roundEndHandled = false;
      this.emit({ type: "match_start", pseudoMatchId: matchId });
    }

    const mode = pluck(info, "game_mode");
    if (typeof mode === "string") {
      this.mode = mode;
      this.emit({ type: "game_mode", mode });
    }

    const mapId = pluck(info, "map_id");
    if (typeof mapId === "string" && mapId) {
      this.map = slugify(mapId) || null;
      this.emit({ type: "map", mapSlug: this.map, rawMapId: mapId });
    }

    // match_info.round_outcome_type — HOW the round ended (e.g.
    // "bomb_detonated"). Buffered here and attached to the next round_end
    // event (which is delivered via the events channel, not info).
    const outcomeType = pluck(info, "round_outcome_type");
    if (typeof outcomeType === "string" && outcomeType) {
      this.roundOutcomeType = outcomeType as RoundOutcomeType;
    }

    const roundNo = pluck(info, "number");
    if (roundNo !== undefined) {
      const n = num(roundNo);
      if (n > 0 && n !== this.round) {
        this.round = n;
        this.roundEndHandled = false;
        this.emit({ type: "round_start", round: n });
      }
    }

    const score = asObject(pluck(info, "score"));
    if (score && ("blue" in score || "orange" in score)) {
      // Local player is always Blue per GEP docs (Dec 2021+).
      this.score = { ally: num(score["blue"]), enemy: num(score["orange"]) };
      this.emit({ type: "score", ...this.score });
    }

    const players = asObject(pluck(info, "players"));
    if (players) {
      this.mergeRoster(players);
      this.emitRoster();
    }

    // NB: R6's "me" feature only exposes `name` (per Overwolf's status feed),
    // so there is no reliable top-level operator here. "My operator" is instead
    // derived from the local roster row (is_local) inside mergeRoster().
  }

  private mergeRoster(players: Record<string, unknown>): void {
    for (const [key, raw] of Object.entries(players)) {
      if (!key.startsWith("roster_")) continue;
      const p = asObject(raw);
      if (!p) continue;
      // Username field: Overwolf's status-feed sample shows `name`, some docs
      // show `player`. Check both (plus legacy player_name) so we're correct
      // whichever the live client sends — validate on hardware (TESTING.md).
      const name = String(p["player"] ?? p["name"] ?? p["player_name"] ?? "").trim();
      if (!name) continue;
      const teamRaw = String(p["team"] ?? "").toLowerCase();
      const isLocal = p["is_local"] === true || p["is_local"] === "true";
      const team: "ally" | "enemy" = isLocal || teamRaw === "blue" ? "ally" : "enemy";
      // operator may be a numeric id (no name to slug) or a string name; only
      // slug real strings, never fabricate a name from a numeric id.
      const opVal = p["operator"];
      const operatorSlug = typeof opVal === "string" ? slugify(opVal.split("/").pop() ?? opVal) || null : null;
      const player: LiveRosterPlayer = {
        username: name,
        team,
        operatorSlug,
        kills: num(p["kills"]),
        deaths: num(p["deaths"]),
        // NOTE: R6's `health` info value carries a permanent +20 offset for the
        // knockout stage — always 20 higher than the in-game number. Subtract
        // 20 before displaying if/when health is surfaced.
      };
      // Optional fields — only set when actually present (never fabricate).
      if (p["assists"] != null) player.assists = num(p["assists"]);
      if (p["ping"] != null) player.ping = num(p["ping"]); // not in current R6 schema
      this.roster.set(name, player);
      // Derive "my operator" from the local player when we can name it.
      if (isLocal && operatorSlug) {
        this.emit({ type: "operator_selected", operatorSlug, rawName: String(opVal) });
      }
    }
  }

  /* ── events ────────────────────────────────────────────────────────── */
  private onEvents(e: overwolf.games.events.NewGameEvents): void {
    for (const ev of e?.events ?? []) {
      switch (ev.name) {
        case "kill":
          this.emit({ type: "kill", headshot: false });
          break;
        case "headshot":
          this.emit({ type: "kill", headshot: true });
          break;
        case "killer":
          this.lastKiller = String(ev.data ?? "") || null;
          break;
        case "death":
          this.emit({ type: "death", killer: this.lastKiller });
          this.lastKiller = null;
          break;
        case "knockedout":
          this.emit({ type: "knocked_out" });
          break;
        case "defuser_planted":
          this.emit({ type: "defuser_planted" });
          break;
        case "defuser_disabled":
          this.emit({ type: "defuser_disabled" });
          break;
        case "roundStart":
          this.round += 1;
          this.roundEndHandled = false;
          this.roundOutcomeType = null;
          this.emit({ type: "round_start", round: this.round });
          break;
        case "roundOutcome": {
          // Carries victory/defeat — the authoritative round result. The
          // buffered round_outcome_type (from match_info) says *how* it ended.
          const won = this.outcomeToWon(ev.data);
          this.roundEndHandled = true;
          this.emit({ type: "round_end", round: this.round, won, outcomeType: this.roundOutcomeType });
          break;
        }
        case "roundEnd":
          // Fallback if no roundOutcome was delivered for this round.
          if (!this.roundEndHandled)
            this.emit({ type: "round_end", round: this.round, won: null, outcomeType: this.roundOutcomeType });
          break;
        case "matchOutcome":
          this.emit({ type: "match_end" });
          this.matchId = null;
          break;
        default:
          // Unknown event — recorded only via lastEventAt for diagnostics.
          break;
      }
    }
  }

  private outcomeToWon(data: unknown): boolean | null {
    const v = String(data ?? "").toLowerCase();
    if (v.includes("victory") || v === "win" || v === "won") return true;
    if (v.includes("defeat") || v === "loss" || v === "lost") return false;
    return null;
  }
}

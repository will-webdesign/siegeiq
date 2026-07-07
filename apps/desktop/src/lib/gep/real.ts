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
  type SiegeEvent,
  type SiegeEventListener,
  type GamePhase,
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
  };
  private roster = new Map<string, LiveRosterPlayer>();
  private round = 0;
  private score = { ally: 0, enemy: 0 };
  private map: string | null = null;
  private mode: string | null = null;
  private matchId: string | null = null;
  private lastKiller: string | null = null;
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

    // The "me" feature arrives as a top-level operator/name on the update.
    const meOperator = pluck(info, "operator");
    if (typeof meOperator === "string" && meOperator) {
      const slug = slugify(meOperator.split("/").pop() ?? meOperator) || null;
      this.emit({ type: "operator_selected", operatorSlug: slug, rawName: meOperator });
    }
  }

  private mergeRoster(players: Record<string, unknown>): void {
    for (const [key, raw] of Object.entries(players)) {
      if (!key.startsWith("roster_")) continue;
      const p = asObject(raw);
      if (!p) continue;
      const name = String(p["name"] ?? p["player_name"] ?? "").trim();
      if (!name) continue;
      const teamRaw = String(p["team"] ?? "").toLowerCase();
      const team: "ally" | "enemy" = p["is_local"] === true || teamRaw === "blue" ? "ally" : "enemy";
      // operator may be a numeric id (no name to slug) or a string name.
      const opVal = p["operator"];
      const operatorSlug = typeof opVal === "string" ? slugify(opVal.split("/").pop() ?? opVal) || null : null;
      this.roster.set(name, {
        username: name,
        team,
        operatorSlug,
        kills: num(p["kills"]),
        deaths: num(p["deaths"]),
      });
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
        case "roundStart":
          this.round += 1;
          this.roundEndHandled = false;
          this.emit({ type: "round_start", round: this.round });
          break;
        case "roundOutcome": {
          // Carries victory/defeat — the authoritative round result.
          const won = this.outcomeToWon(ev.data);
          this.roundEndHandled = true;
          this.emit({ type: "round_end", round: this.round, won });
          break;
        }
        case "roundEnd":
          // Fallback if no roundOutcome was delivered for this round.
          if (!this.roundEndHandled) this.emit({ type: "round_end", round: this.round, won: null });
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

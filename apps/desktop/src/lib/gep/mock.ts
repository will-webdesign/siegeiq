/**
 * Dev-mode match simulator. Emits the same SiegeEvent stream as the real
 * GEP adapter so all UI + coaching logic can be developed without R6 or
 * Overwolf. Every payload is clearly labeled source:"mock" — simulated data
 * is a development tool and is never presented as real player data.
 */
import type { LiveMatchState, LiveRosterPlayer } from "@siegeiq/shared";
import type { GepSource, GepStatus, SiegeEvent, SiegeEventListener } from "./types";
import { REQUIRED_FEATURES } from "./types";

const ALLY_OPS_ATK = ["ace", "thatcher", "buck", "iana", "thermite"];
const ENEMY_OPS_DEF = ["jager", "bandit", "mute", "valkyrie", "smoke"];
const NAMES_A = ["You", "Nomad_Main", "SoloQ_Hero", "FlankWatch", "PlantDenier"];
const NAMES_E = ["RoamKing", "C4Enjoyer", "AceOfSpades", "PixelPeek", "SiteAnchor"];

export class MockGepSource implements GepSource {
  private listeners = new Set<SiegeEventListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private st: GepStatus = {
    source: "mock",
    connected: false,
    featuresRequested: REQUIRED_FEATURES,
    featuresGranted: REQUIRED_FEATURES,
    lastEventAt: null,
    gameRunning: false,
    error: null,
    version: { localVersion: "mock", publicVersion: "mock", upToDate: true },
    degradedFeatures: [],
  };
  private round = 0;
  private score = { ally: 0, enemy: 0 };
  private speed: number;

  constructor(opts: { speed?: number } = {}) {
    this.speed = opts.speed ?? 1;
  }

  async start(): Promise<void> {
    this.st.connected = true;
    this.st.gameRunning = true;
    this.script();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  status(): GepStatus {
    return { ...this.st };
  }

  on(listener: SiegeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setDegradedFeatures(features: string[]): void {
    this.st.degradedFeatures = features;
  }

  private emit(e: SiegeEvent): void {
    this.st.lastEventAt = Date.now();
    for (const l of this.listeners) l(e);
  }

  private roster(side: "attacker" | "defender", revealed: number): LiveRosterPlayer[] {
    const allyOps = side === "attacker" ? ALLY_OPS_ATK : ENEMY_OPS_DEF;
    const enemyOps = side === "attacker" ? ENEMY_OPS_DEF : ALLY_OPS_ATK;
    const mk = (names: string[], ops: string[], team: "ally" | "enemy", n: number): LiveRosterPlayer[] =>
      names.map((username, i) => ({
        username,
        team,
        operatorSlug: i < n ? (ops[i] ?? null) : null,
        kills: this.round > 0 ? Math.max(0, (i * 7 + this.round * 3) % 5) : 0,
        deaths: this.round > 0 ? (i + this.round) % 3 : 0,
        assists: this.round > 0 ? (i + this.round) % 2 : 0,
        ping: 20 + ((i * 13 + this.round * 7) % 60),
      }));
    return [...mk(NAMES_A, allyOps, "ally", revealed), ...mk(NAMES_E, enemyOps, "enemy", revealed)];
  }

  private state(side: "attacker" | "defender", revealed: number): LiveMatchState {
    return {
      profileId: "mock",
      map: "clubhouse",
      mode: "ranked",
      round: this.round,
      side,
      score: this.score,
      roster: this.roster(side, revealed),
      updatedAt: Date.now(),
    };
  }

  /** Scripted ranked match on Clubhouse: select → 4 rounds → end, looped. */
  private script(): void {
    const steps: Array<{ delay: number; run: () => void }> = [];
    const push = (delay: number, run: () => void) => steps.push({ delay, run });

    push(500, () => this.emit({ type: "game_launched" }));
    push(800, () => this.emit({ type: "phase", phase: "lobby" }));
    push(1500, () => {
      this.emit({ type: "match_start", pseudoMatchId: `mock-${Date.now()}` });
      this.emit({ type: "game_mode", mode: "ranked" });
      this.emit({ type: "map", mapSlug: "clubhouse", rawMapId: "Clubhouse-mock" });
    });

    for (let r = 1; r <= 4; r++) {
      const side: "attacker" | "defender" = r <= 2 ? "attacker" : "defender";
      push(1500, () => {
        this.round = r;
        this.emit({ type: "phase", phase: "operator_select" });
        this.emit({ type: "side", side });
        this.emit({ type: "operator_selected", operatorSlug: side === "attacker" ? "ace" : "jager", rawName: "" });
        this.emit({ type: "roster_update", state: this.state(side, 3) });
      });
      push(2500, () => {
        this.emit({ type: "phase", phase: "in_round" });
        this.emit({ type: "round_start", round: r });
        this.emit({ type: "roster_update", state: this.state(side, 5) });
      });
      push(2000, () => this.emit({ type: "kill", headshot: r % 2 === 0 }));
      if (r === 2) push(1200, () => this.emit({ type: "defuser_planted" }));
      if (r === 3) push(1500, () => this.emit({ type: "death", killer: "RoamKing" }));
      push(2000, () => {
        const won = r % 2 === 1;
        if (won) this.score = { ...this.score, ally: this.score.ally + 1 };
        else this.score = { ...this.score, enemy: this.score.enemy + 1 };
        // Cycle a couple of plausible outcome types so the UI exercises them.
        const outcomeType = won ? "objective_secured" : r % 2 === 0 ? "bomb_detonated" : "team_has_been_eliminated";
        this.emit({ type: "round_end", round: r, won, outcomeType });
        this.emit({ type: "score", ...this.score });
        this.emit({ type: "phase", phase: "round_results" });
        this.emit({ type: "roster_update", state: this.state(side, 5) });
      });
    }

    push(2000, () => {
      this.emit({ type: "match_end" });
      this.round = 0;
      this.score = { ally: 0, enemy: 0 };
    });
    push(4000, () => this.script());

    let i = 0;
    const next = () => {
      const s = steps[i++];
      if (!s) return;
      this.timer = setTimeout(() => {
        s.run();
        next();
      }, s.delay / this.speed);
    };
    next();
  }
}

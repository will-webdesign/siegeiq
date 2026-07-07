import type { LiveMatchState } from "@siegeiq/shared";
import type { GamePhase, GepStatus, SiegeEvent } from "@/lib/gep/types";

export interface KillFeedEntry {
  at: number;
  text: string;
  kind: "kill" | "death" | "objective" | "round" | "match";
}

export interface EventLogEntry {
  at: number;
  event: SiegeEvent;
}

export interface SessionRound {
  round: number;
  won: boolean | null;
  kills: number;
  deaths: number;
  side: "attacker" | "defender" | null;
}

export interface AppState {
  mode: "overwolf" | "dev";
  gep: GepStatus;
  phase: GamePhase;
  gameRunning: boolean;
  matchActive: boolean;
  side: "attacker" | "defender" | null;
  myOperator: string | null;
  live: LiveMatchState | null;
  killFeed: KillFeedEntry[];
  eventLog: EventLogEntry[];
  sessionRounds: SessionRound[];
  roundKills: number;
  roundDeaths: number;
  overlayVisible: boolean;
}

export const initialAppState = (mode: "overwolf" | "dev"): AppState => ({
  mode,
  gep: {
    source: mode === "overwolf" ? "overwolf" : "mock",
    connected: false,
    featuresRequested: [],
    featuresGranted: [],
    lastEventAt: null,
    gameRunning: false,
    error: null,
  },
  phase: "unknown",
  gameRunning: false,
  matchActive: false,
  side: null,
  myOperator: null,
  live: null,
  killFeed: [],
  eventLog: [],
  sessionRounds: [],
  roundKills: 0,
  roundDeaths: 0,
  overlayVisible: true,
});

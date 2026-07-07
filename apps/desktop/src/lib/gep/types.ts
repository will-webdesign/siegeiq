/**
 * Domain game events — the normalized shape the rest of the app consumes.
 * Both the real Overwolf GEP adapter and the dev-mode simulator emit these.
 * Raw GEP payloads never leak past src/lib/gep.
 */
import type { LiveMatchState } from "@siegeiq/shared";

export type GamePhase =
  | "lobby"
  | "teammates"
  | "announce"
  | "operator_select"
  | "loading"
  | "in_round"
  | "round_results"
  | "unknown";

export type SiegeEvent =
  | { type: "game_launched" }
  | { type: "game_closed" }
  | { type: "phase"; phase: GamePhase }
  | { type: "match_start"; pseudoMatchId: string }
  | { type: "match_end" }
  | { type: "map"; mapSlug: string | null; rawMapId: string }
  | { type: "game_mode"; mode: string }
  | { type: "round_start"; round: number }
  | { type: "round_end"; round: number; won: boolean | null }
  | { type: "side"; side: "attacker" | "defender" }
  | { type: "operator_selected"; operatorSlug: string | null; rawName: string }
  | { type: "roster_update"; state: LiveMatchState }
  | { type: "kill"; headshot: boolean }
  | { type: "death"; killer: string | null }
  | { type: "knocked_out" }
  | { type: "defuser_planted" }
  | { type: "defuser_disabled" }
  | { type: "score"; ally: number; enemy: number };

export interface GepStatus {
  source: "overwolf" | "mock";
  connected: boolean;
  featuresRequested: string[];
  featuresGranted: string[];
  lastEventAt: number | null;
  gameRunning: boolean;
  error: string | null;
}

export type SiegeEventListener = (event: SiegeEvent) => void;

export interface GepSource {
  start(): Promise<void>;
  stop(): void;
  status(): GepStatus;
  on(listener: SiegeEventListener): () => void;
}

/** Features requested from the Overwolf Game Events Provider for R6 (game 10826).
 *  Names mirror the typed R6 GEP schema in @overwolf/types/rainbow-six.d.ts
 *  (overwolf.gep.R6). The granted subset is validated at runtime via
 *  setRequiredFeatures().supportedFeatures — see TESTING.md. */
export const REQUIRED_FEATURES = [
  "game_info",
  "match",
  "match_info",
  "roster",
  "kill",
  "death",
  "me",
];

import type { BoardId, Platform, PlatformFamily } from "./constants";

/** ── Domain view-models (provider-agnostic) ────────────────────────── */

export interface PlayerIdentity {
  profileId: string;
  userId: string;
  platform: Platform;
  username: string;
  avatarUrl: string;
}

export interface BoardProfile {
  board: BoardId;
  seasonId: number;
  rankPoints: number;
  maxRankPoints: number;
  kills: number;
  deaths: number;
  wins: number;
  losses: number;
  abandons: number;
  updatedAt: string | null;
}

export interface SeasonBoards {
  profileId: string;
  family: PlatformFamily;
  seasonId: number;
  boards: BoardProfile[];
}

export interface SummaryStats {
  seasonId: number;
  gameMode: string; // all | ranked | casual | unranked
  matchesPlayed: number;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  headshotPct: number; // 0..1
  wins: number;
  losses: number;
  openingKills: number;
  openingDeaths: number;
  plants: number;
  defuses: number;
  aces: number;
  clutches: number;
  timePlayedSeconds: number;
  accuracy: number | null; // 0..1 or null (Ubisoft stopped recording bullets fired reliably)
}

export type Side = "attacker" | "defender";

export interface OperatorStat {
  operatorSlug: string;
  operatorName: string;
  side: Side;
  seasonId: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsLost: number;
  kills: number;
  deaths: number;
  headshotPct: number;
  timePlayedSeconds: number;
}

export interface WeaponStat {
  weaponSlug: string;
  weaponName: string;
  seasonId: number;
  kills: number;
  headshots: number;
  headshotPct: number;
  roundsPlayed: number;
}

export interface MapStat {
  mapSlug: string;
  mapName: string;
  seasonId: number;
  side: Side | "all";
  roundsPlayed: number;
  roundsWon: number;
  roundsLost: number;
  matchesWon: number;
  matchesLost: number;
  kills: number;
  deaths: number;
}

export interface ProgressionInfo {
  level: number;
  totalTimePlayedSeconds: number;
}

export interface PlatformStatus {
  platform: string;
  status: "online" | "degraded" | "maintenance" | "unknown";
  impactedFeatures: string[];
}

export interface LiveRosterPlayer {
  username: string;
  team: "ally" | "enemy";
  operatorSlug: string | null;
  kills: number;
  deaths: number;
  /** Optional GEP roster fields — present only when the provider supplies them
   *  (never fabricated). `assists` is in R6's published roster schema; `ping`
   *  is not currently, so it is captured defensively for forward-compat and
   *  will usually be undefined. */
  assists?: number;
  ping?: number;
  profileId?: string;
}

export interface LiveMatchState {
  profileId: string;
  map: string | null;
  mode: string | null;
  round: number;
  side: Side | null;
  score: { ally: number; enemy: number };
  roster: LiveRosterPlayer[];
  updatedAt: number;
}

/** ── Query shapes ──────────────────────────────────────────────────── */

export interface StatsQuery {
  profileId: string;
  platform: Platform;
  seasonId?: number;
  gameMode?: "all" | "ranked" | "casual" | "unranked";
}

/** ── Provider contracts ────────────────────────────────────────────── */

export interface ProviderMeta {
  id: string;
  label: string;
  official: boolean;
  /** True when required credentials/config exist. */
  configured(): boolean;
}

export interface IIdentityProvider extends ProviderMeta {
  searchByUsername(platform: Platform, username: string): Promise<PlayerIdentity[]>;
}

export interface IRankProvider extends ProviderMeta {
  getBoards(profileId: string, family: PlatformFamily): Promise<SeasonBoards>;
}

export interface IPlayerStatsProvider extends ProviderMeta {
  getSummary(q: StatsQuery): Promise<SummaryStats>;
  getOperators(q: StatsQuery): Promise<OperatorStat[]>;
  getWeapons(q: StatsQuery): Promise<WeaponStat[]>;
  getMaps(q: StatsQuery): Promise<MapStat[]>;
  getProgression(profileId: string, platform: Platform): Promise<ProgressionInfo>;
}

export interface IServiceStatusProvider extends ProviderMeta {
  getStatus(): Promise<PlatformStatus[]>;
}

export type FullProvider = IIdentityProvider &
  IRankProvider &
  IPlayerStatsProvider &
  IServiceStatusProvider;

export class ProviderUnavailableError extends Error {
  constructor(providerId: string, reason: string) {
    super(`[${providerId}] unavailable: ${reason}`);
    this.name = "ProviderUnavailableError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** A single inferred ranked match — the coaching engine's input contract.
 *  Lives here (not in @siegeiq/server) so pure consumers like @siegeiq/coaching
 *  and the desktop app can depend on it without importing server code. */
export interface MatchRow {
  playedAt: number;
  board: string;
  outcome: "win" | "loss" | "abandon";
  rpDelta: number;
  kills: number;
  deaths: number;
  confidence: "high" | "low";
}

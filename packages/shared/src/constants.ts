/**
 * Game + Ubisoft service constants.
 * Space IDs and app IDs are community-documented values used by every Siege
 * tracker (see docs/RESEARCH.md §2.1). Season IDs: Solar Raid = 28 (verified);
 * Y10S4 = 40 and Y11S1 = 41 verified from R6Data docs, giving the arithmetic
 * for the seasons in between. Names marked verified=false are placeholders
 * until confirmed each season — never present them as canon in the UI.
 */

export const UBI = {
  BASE: "https://public-ubiservices.ubi.com",
  DATADEV: "https://prod.datadev.ubisoft.com",
  STATUS: "https://game-status-api.ubisoft.com/v1/instances",
  /** Ubi-AppId historically used by web integrations. */
  APP_ID: "3587dcbb-7f81-457c-9781-0e3f29f6f56a",
  /** Newer app id used for datadev/new-gen endpoints. */
  APP_ID_V2: "e3d5ea9e-50bd-43b7-88bf-39794f4e3d40",
  SPACES: {
    pc: "5172a557-50b5-4665-b7db-e3f2e8c5041d",
    ps4: "05bfb3f7-6c21-4c42-be1f-97a33fb5cf66",
    xboxone: "98a601e5-ca91-4440-b1c5-753f601a2c90",
  },
} as const;

export type Platform = "uplay" | "psn" | "xbl";
export type PlatformFamily = "pc" | "console";
export const PLATFORMS: Platform[] = ["uplay", "psn", "xbl"];

export function platformFamily(p: Platform): PlatformFamily {
  return p === "uplay" ? "pc" : "console";
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  uplay: "PC / Ubisoft Connect",
  psn: "PlayStation",
  xbl: "Xbox",
};

export interface SeasonInfo {
  id: number;
  code: string; // e.g. Y9S1
  name: string;
  verified: boolean;
}

export const SEASONS: SeasonInfo[] = [
  { id: 28, code: "Y7S4", name: "Solar Raid", verified: true },
  { id: 29, code: "Y8S1", name: "Commanding Force", verified: true },
  { id: 30, code: "Y8S2", name: "Dread Factor", verified: true },
  { id: 31, code: "Y8S3", name: "Heavy Mettle", verified: true },
  { id: 32, code: "Y8S4", name: "Deep Freeze", verified: true },
  { id: 33, code: "Y9S1", name: "Deadly Omen", verified: true },
  { id: 34, code: "Y9S2", name: "New Blood", verified: true },
  { id: 35, code: "Y9S3", name: "Twin Shells", verified: true },
  { id: 36, code: "Y9S4", name: "Collision Point", verified: true },
  { id: 37, code: "Y10S1", name: "Prep Phase", verified: true },
  { id: 38, code: "Y10S2", name: "Daybreak", verified: true },
  { id: 39, code: "Y10S3", name: "High Stakes", verified: true },
  { id: 40, code: "Y10S4", name: "Tenfold Pursuit", verified: true },
  { id: 41, code: "Y11S1", name: "Silent Hunt", verified: true },
  { id: 42, code: "Y11S2", name: "System Override", verified: true },
];

export const CURRENT_SEASON_ID = 42;

export function seasonById(id: number): SeasonInfo {
  return (
    SEASONS.find((s) => s.id === id) ?? {
      id,
      code: `S${id}`,
      name: `Season ${id}`,
      verified: false,
    }
  );
}

export type BoardId = "ranked" | "standard" | "casual" | "event" | "warmup";
export const BOARDS: BoardId[] = ["ranked", "standard", "casual", "event", "warmup"];
export const BOARD_LABELS: Record<BoardId, string> = {
  ranked: "Ranked",
  standard: "Standard",
  casual: "Quick Match",
  event: "Event",
  warmup: "Warmup",
};

/** Ranked 2.0 ladder (RP thresholds). */
export interface RankTier {
  name: string;
  short: string;
  minRp: number;
  color: string;
}

const DIVISIONS = ["V", "IV", "III", "II", "I"] as const;

function tiers(base: string, short: string, start: number, color: string): RankTier[] {
  return DIVISIONS.map((d, i) => ({
    name: `${base} ${d}`,
    short: `${short}${5 - i}`,
    minRp: start + i * 100,
    color,
  }));
}

export const RANK_TIERS: RankTier[] = [
  ...tiers("Copper", "C", 1000, "#b45f4a"),
  ...tiers("Bronze", "B", 1500, "#a97142"),
  ...tiers("Silver", "S", 2000, "#9aa5b1"),
  ...tiers("Gold", "G", 2500, "#e8b64c"),
  ...tiers("Platinum", "P", 3000, "#3fd0c9"),
  ...tiers("Emerald", "E", 3500, "#2ecc71"),
  ...tiers("Diamond", "D", 4000, "#7aa7ff"),
  { name: "Champions", short: "CH", minRp: 4500, color: "#ff5c8a" },
];

export const SITE = {
  name: "SiegeIQ",
  tagline: "Know the lobby before the drone phase.",
  description:
    "SiegeIQ is a Rainbow Six Siege companion: player stats, rank history, operator analytics, and live match intelligence.",
} as const;

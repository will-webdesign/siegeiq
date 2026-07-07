/**
 * @siegeiq/game-data — versioned Rainbow Six Siege game data.
 *
 * Game content is data, not code: operators/maps/weapons ship as JSON so they
 * can be revised independently of application logic. Every dataset revision
 * bumps GAME_DATA_VERSION; consumers surface it as provenance ("game data as
 * of Y11S2 System Override").
 *
 * Sources: Ubisoft season pages & news posts, siege.gg operator guides.
 * Rule: unverified fields are left empty rather than guessed (see README).
 */
import operatorsJson from "./operators.json";
import mapsJson from "./maps.json";
import weaponsJson from "./weapons.json";

export interface OperatorData {
  slug: string;
  name: string;
  side: "attacker" | "defender";
  speed: 1 | 2 | 3;
  health: 100 | 110 | 125;
  org: string;
  ability: string;
  primaries: string[];
  secondaries: string[];
  gadgets: string[];
  difficulty: 1 | 2 | 3;
  tags: string[];
  counters: string[];
  counteredBy: string[];
}

export interface MapData {
  slug: string;
  name: string;
  location: string;
  released: string;
  ranked: boolean;
  sites: string[];
  lean: "attacker" | "defender" | "balanced";
  bestAttackers: string[];
  bestDefenders: string[];
  notes: string;
}

export interface WeaponData {
  slug: string;
  name: string;
  type: string;
  damage: number;
  fireRate: number | null;
  users: string[];
  [k: string]: unknown;
}

/** Bump on every dataset revision. Format: <season code>.<revision>. */
export const GAME_DATA_VERSION = "Y11S2.2";
/** Last dataset verification date (research pass against Ubisoft sources). */
export const GAME_DATA_UPDATED = "2026-07-07";

export const operators = operatorsJson as unknown as OperatorData[];
export const maps = mapsJson as unknown as MapData[];
export const weapons = weaponsJson as unknown as WeaponData[];

export const operatorBySlug = new Map(operators.map((o) => [o.slug, o]));
export const mapBySlug = new Map(maps.map((m) => [m.slug, m]));

export function findOperator(slug: string): OperatorData | undefined {
  return operatorBySlug.get(slug);
}
export function findMap(slug: string): MapData | undefined {
  return mapBySlug.get(slug);
}
